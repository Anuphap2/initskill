import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const MANIFEST_NAME = '.agent-skill-manager.json';
const MANIFEST_SCHEMA_VERSION = 1;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeRelative(path) {
  return path.replaceAll('\\', '/');
}

function resolveSafe(root, relativePath) {
  const rootPath = resolve(root);
  const target = resolve(rootPath, relativePath);
  if (target !== rootPath && !target.startsWith(`${rootPath}${sep}`)) {
    throw new Error(`ไฟล์เป้าหมายอยู่นอกโฟลเดอร์โปรเจกต์: ${relativePath}`);
  }

  let current = rootPath;
  const parts = relative(rootPath, target).split(sep);
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`หยุดเพื่อความปลอดภัย: พบ symbolic link ในเส้นทาง ${relativePath}`);
    }
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error(`หยุดเพื่อความปลอดภัย: ไฟล์เป้าหมายเป็น symbolic link: ${relativePath}`);
  }
  return target;
}

function loadManifest(root) {
  const path = resolveSafe(root, MANIFEST_NAME);
  if (!existsSync(path)) return { path, value: { schemaVersion: MANIFEST_SCHEMA_VERSION, modes: [], managedFiles: {} } };

  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${MANIFEST_NAME} อ่านไม่ได้หรือ JSON ไม่ถูกต้อง จึงหยุดเพื่อไม่เสี่ยงเขียนทับข้อมูล`);
  }
  if (value?.schemaVersion !== MANIFEST_SCHEMA_VERSION || !Array.isArray(value.modes) || typeof value.managedFiles !== 'object' || value.managedFiles === null || Array.isArray(value.managedFiles)) {
    throw new Error(`${MANIFEST_NAME} ใช้ schema ที่ไม่รองรับ กรุณาสำรองไฟล์แล้วตรวจสอบก่อน`);
  }
  return { path, value };
}

function hasManagedBlock(content, start, end) {
  const startCount = content.split(start).length - 1;
  const endCount = content.split(end).length - 1;
  if (startCount === 0 && endCount === 0) return null;
  if (startCount !== 1 || endCount !== 1) return null;
  const startAt = content.indexOf(start);
  const endAt = content.indexOf(end);
  if (startAt < 0 || endAt < startAt) return null;
  return content.slice(startAt, endAt + end.length);
}

function mergeManagedContent(existing, generated, markers) {
  const starts = existing.split(markers.start).length - 1;
  const ends = existing.split(markers.end).length - 1;
  if ((starts === 0) !== (ends === 0) || starts > 1 || ends > 1) {
    throw new Error('AGENTS.md มี managed markers ซ้ำหรือไม่ครบ จึงหยุดเพื่อไม่ลบเนื้อหาของผู้ใช้');
  }
  if (starts === 1 && existing.indexOf(markers.end) < existing.indexOf(markers.start)) {
    throw new Error('AGENTS.md มี managed markers เรียงลำดับไม่ถูกต้อง จึงหยุดเพื่อไม่ลบเนื้อหาของผู้ใช้');
  }
  const escapedStart = markers.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = markers.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'm');
  if (pattern.test(existing)) return existing.replace(pattern, generated.trim());
  return `${existing.trim()}\n\n${generated.trim()}\n`;
}

function metadataFor(entry) {
  const metadata = { sha256: sha256(entry.content) };
  if (entry.managedMarkers) {
    const block = hasManagedBlock(entry.content, entry.managedMarkers.start, entry.managedMarkers.end);
    if (block) metadata.managedBlockSha256 = sha256(block);
  }
  return metadata;
}

export function createWritePlan({ root, files, mode, managedMarkers, conflictPolicy = 'prompt' }) {
  if (!['prompt', 'keep', 'overwrite', 'error'].includes(conflictPolicy)) {
    throw new Error(`นโยบายไฟล์ชนกันไม่ถูกต้อง: ${conflictPolicy}`);
  }
  const { path: manifestPath, value: manifest } = loadManifest(root);
  const seen = new Set();
  const entries = files.map((file) => {
    const key = normalizeRelative(file.relativePath);
    if (key === MANIFEST_NAME) throw new Error(`${MANIFEST_NAME} เป็นไฟล์ภายในของเครื่องมือ`);
    if (seen.has(key)) throw new Error(`มีหลายกฎสร้างไฟล์ตำแหน่งเดียวกัน: ${key}`);
    seen.add(key);

    const target = resolveSafe(root, file.relativePath);
    const exists = existsSync(target);
    const existing = exists ? readFileSync(target, 'utf8') : null;
    const entry = { ...file, key, target, existing, content: file.content, action: 'create', conflict: false };
    if (file.mergeManaged && managedMarkers) entry.managedMarkers = managedMarkers;

    if (file.preserveIfExists && exists) {
      entry.action = 'preserve';
      return entry;
    }

    if (exists && file.mergeManaged && managedMarkers) {
      entry.content = mergeManagedContent(existing, file.content, managedMarkers);
    }
    if (!exists) return entry;
    if (existing === entry.content) {
      entry.action = 'unchanged';
      return entry;
    }

    const previous = manifest.managedFiles[key];
    const existingHash = sha256(existing);
    const block = file.mergeManaged && managedMarkers
      ? hasManagedBlock(existing, managedMarkers.start, managedMarkers.end)
      : null;
    const managedBlockIsUnchanged = Boolean(
      previous?.managedBlockSha256 && block && sha256(block) === previous.managedBlockSha256,
    );
    const safelyOwned = previous?.sha256 === existingHash || managedBlockIsUnchanged;

    if (safelyOwned) {
      entry.action = 'update';
      return entry;
    }

    entry.action = 'conflict';
    entry.conflict = true;
    if (conflictPolicy === 'keep') entry.action = 'keep';
    if (conflictPolicy === 'overwrite') entry.action = 'overwrite';
    if (conflictPolicy === 'error') {
      throw new Error(`ไฟล์มีอยู่แล้วและไม่ได้เป็นไฟล์ที่จัดการได้อย่างปลอดภัย: ${key} (ดู diff แล้วเลือก --on-conflict)`);
    }
    return entry;
  });

  const plan = { root: resolve(root), mode, entries, manifestPath, manifest, conflictPolicy };
  finalizeWritePlan(plan);
  return plan;
}

export function finalizeWritePlan(plan) {
  const managedFiles = { ...plan.manifest.managedFiles };
  let appliedCount = 0;
  for (const entry of plan.entries) {
    if (['create', 'update', 'overwrite', 'unchanged'].includes(entry.action)) {
      managedFiles[entry.key] = metadataFor(entry);
      appliedCount += 1;
    }
  }
  const modes = [...new Set(plan.manifest.modes)];
  if (appliedCount > 0 && !modes.includes(plan.mode)) modes.push(plan.mode);
  plan.nextManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    modes,
    managedFiles,
  };
  plan.manifestContent = `${JSON.stringify(plan.nextManifest, null, 2)}\n`;
  plan.manifestChanged = !existsSync(plan.manifestPath)
    || readFileSync(plan.manifestPath, 'utf8') !== plan.manifestContent;
  return plan;
}

export function formatLineDiff(before, after, maxLines = 80) {
  const oldLines = before.split(/\r?\n/);
  const newLines = after.split(/\r?\n/);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix
    && suffix < newLines.length - prefix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) suffix += 1;

  const context = 3;
  const oldEnd = oldLines.length - suffix;
  const newEnd = newLines.length - suffix;
  const start = Math.max(0, prefix - context);
  const oldMiddle = oldLines.slice(start, oldEnd);
  const newMiddle = newLines.slice(start, newEnd);
  const lines = [
    ...oldLines.slice(start, prefix).map((line) => `  ${line}`),
    ...oldMiddle.slice(prefix - start).map((line) => `- ${line}`),
    ...newMiddle.slice(prefix - start).map((line) => `+ ${line}`),
    ...oldLines.slice(oldEnd, oldEnd + context).map((line) => `  ${line}`),
  ];
  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines) limited.push(`… diff ถูกตัด เหลืออีก ${lines.length - maxLines} บรรทัด`);
  return limited.join('\n') || '(ไม่มีความเปลี่ยนแปลง)';
}

function createBackup(root, relativePath, content, backupStamp) {
  const backupPath = resolveSafe(root, join('.agent-skills-backups', backupStamp, relativePath));
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, content, 'utf8');
  return backupPath;
}

function atomicWrite(target, content) {
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const mode = existsSync(target) ? statSync(target).mode : 0o666;
  writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode });
  try {
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function applyWritePlan(plan, { dryRun = false, backupStamp = new Date().toISOString().replaceAll(/[:.]/g, '-') } = {}) {
  finalizeWritePlan(plan);
  const actions = plan.entries.filter((entry) => ['create', 'update', 'overwrite'].includes(entry.action));
  const manifestNeedsWrite = plan.manifestChanged || actions.length > 0;
  if (dryRun) return { written: [], backups: [], dryRun: true };

  const backups = [];
  const completed = [];
  try {
    for (const entry of actions) {
      if (entry.action === 'overwrite' && entry.existing !== null) {
        backups.push(createBackup(plan.root, entry.key, entry.existing, backupStamp));
      }
    }
    for (const entry of actions) {
      if (entry.existing !== null) {
        const rollbackPath = `${entry.target}.${process.pid}.${randomUUID()}.rollback`;
        writeFileSync(rollbackPath, entry.existing, 'utf8');
        completed.push({ entry, rollbackPath, created: false });
      } else {
        completed.push({ entry, rollbackPath: null, created: true });
      }
      atomicWrite(entry.target, entry.content);
    }
    if (manifestNeedsWrite) atomicWrite(plan.manifestPath, plan.manifestContent);
    for (const item of completed) if (item.rollbackPath) rmSync(item.rollbackPath, { force: true });
  } catch (error) {
    for (const item of completed.reverse()) {
      try {
        if (item.rollbackPath && existsSync(item.rollbackPath)) {
          renameSync(item.rollbackPath, item.entry.target);
        } else if (item.created) {
          rmSync(item.entry.target, { force: true });
        }
      } catch { /* Preserve the original error; durable backups remain available. */ }
    }
    throw new Error(`เขียนไฟล์ไม่ครบ จึงพยายามย้อนคืนไฟล์ที่เปลี่ยนแล้ว: ${error.message}`);
  }
  return { written: actions.map((entry) => entry.key), backups, dryRun: false };
}

export function listMarkdownFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(path);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [path] : [];
  }).sort((a, b) => a.localeCompare(b));
}

export function readProjectManifest(root) {
  return loadManifest(root).value;
}

export function backupExistingFile(root, relativePath, content) {
  const backupStamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return createBackup(root, relativePath, content, backupStamp);
}

export function writeFileSafely(root, relativePath, content) {
  const target = resolveSafe(root, relativePath);
  atomicWrite(target, content);
  return target;
}
