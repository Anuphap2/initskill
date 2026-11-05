#!/usr/bin/env node

import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sha256, writeFileSafely } from './file-safety.mjs';

const SOURCE = dirname(fileURLToPath(import.meta.url));
const INSTALL_MANIFEST = '.install-manifest.json';
const RUNTIME_FILES = [
  'cli.mjs', 'file-safety.mjs', 'skills-manager.mjs', 'release-bundle.mjs', 'package.json', 'README.md', 'CHANGELOG.md', 'DISTRIBUTION.md',
  'install.mjs', 'uninstall.mjs', 'install.ps1', 'uninstall.ps1', 'install.sh', 'uninstall.sh',
  'initskill.cmd', 'initskill',
];

function parseArgs(args) {
  const options = { prefix: join(homedir(), '.agent-skills'), force: false, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--prefix') options.prefix = args[++i];
    else if (args[i] === '--force') options.force = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else throw new Error(`ไม่รู้จัก option: ${args[i]}`);
  }
  if (!options.prefix) throw new Error('--prefix ต้องระบุ path');
  return options;
}

function walkFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) return walkFiles(root, path);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [path] : [];
  });
}

function loadInstallManifest(target) {
  const path = join(target, INSTALL_MANIFEST);
  if (!existsSync(path)) return null;
  let value;
  try { value = JSON.parse(readFileSync(path, 'utf8')); } catch {
    throw new Error(`${INSTALL_MANIFEST} เสียหาย จึงหยุดเพื่อไม่เขียนทับข้อมูล`);
  }
  if (value?.schemaVersion !== 1 || typeof value.files !== 'object' || !value.files) {
    throw new Error(`${INSTALL_MANIFEST} ใช้ schema ที่ไม่รองรับ`);
  }
  return value;
}

function ensureInside(target, relativePath) {
  const root = resolve(target);
  const path = resolve(root, relativePath);
  if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error(`path อยู่นอก install directory: ${relativePath}`);
  return path;
}

function readSourceFiles() {
  const lockfile = existsSync(join(SOURCE, 'package-lock.json'))
    ? 'package-lock.json'
    : 'npm-shrinkwrap.json';
  if (!existsSync(join(SOURCE, lockfile))) throw new Error('ไม่พบ package-lock.json หรือ npm-shrinkwrap.json สำหรับติดตั้งแบบ reproducible');
  return [
    ...RUNTIME_FILES,
    lockfile,
    ...walkFiles(join(SOURCE, 'skills')).map((path) => join('skills', path)),
  ].map((path) => ({ path: path.replaceAll('\\', '/'), content: readFileSync(join(SOURCE, path), 'utf8') }));
}

function legacyManagerInstall(target) {
  const packagePath = join(target, 'package.json');
  if (!existsSync(packagePath)) return false;
  try { return JSON.parse(readFileSync(packagePath, 'utf8')).name === 'local-agent-skill-manager'; } catch { return false; }
}

function main() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error(`ต้องใช้ Node.js 20 ขึ้นไป (ปัจจุบัน ${process.versions.node})`);
  const options = parseArgs(process.argv.slice(2));
  const target = resolve(options.prefix);
  const home = resolve(homedir());
  const sameHome = process.platform === 'win32' ? target.toLowerCase() === home.toLowerCase() : target === home;
  if (target === resolve(target, '..') || sameHome) throw new Error('install directory กว้างเกินไป; ระบุโฟลเดอร์เฉพาะ เช่น ~/.agent-skills');
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('install directory เป็น symbolic link; เลือก path จริงเพื่อความปลอดภัย');
  const prior = loadInstallManifest(target);
  const legacy = !prior && legacyManagerInstall(target);
  if (!prior && !legacy && existsSync(join(target, 'package.json'))) {
    throw new Error(`พบ package.json ที่ไม่ใช่เครื่องมือนี้ใน ${target} — เลือก install directory ใหม่`);
  }
  if (!prior && !legacy && existsSync(join(target, 'node_modules'))) {
    throw new Error(`พบ node_modules เดิมใน ${target}; ปฏิเสธการใช้ npm ci เพื่อไม่ลบ dependencies ของโปรเจกต์อื่น`);
  }

  const previousFiles = prior?.files ?? {};
  const nextFiles = { ...previousFiles };
  const warnings = [];
  const changes = [];
  for (const file of readSourceFiles()) {
    const path = ensureInside(target, file.path);
    const sourceHash = sha256(file.content);
    const exists = existsSync(path);
    const oldHash = previousFiles[file.path];
    const current = exists ? readFileSync(path, 'utf8') : null;
    if (!exists) {
      changes.push({ ...file, action: 'install', sourceHash });
      nextFiles[file.path] = sourceHash;
      continue;
    }
    if (current === file.content) {
      nextFiles[file.path] = sourceHash;
      continue;
    }

    const isSkill = file.path.startsWith('skills/');
    const unchangedManagedFile = Boolean(oldHash && sha256(current) === oldHash);
    const legacyCoreFile = Boolean(legacy && !isSkill);
    if (options.force || unchangedManagedFile || legacyCoreFile) {
      if ((options.force || legacyCoreFile) && current !== null) {
        const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
        const backupRelative = `.install-backups/${stamp}/${file.path}`;
        changes.push({ path: backupRelative, content: current, action: 'backup' });
      }
      changes.push({ ...file, action: 'update', sourceHash });
      nextFiles[file.path] = sourceHash;
    } else {
      warnings.push(`เก็บไฟล์ที่มีการแก้ไขไว้ ไม่อัปเดต: ${file.path}`);
      if (isSkill && !oldHash) delete nextFiles[file.path];
    }
  }

  console.log(`Install directory: ${target}`);
  for (const item of changes) console.log(`${item.action === 'backup' ? 'สำรอง' : item.action === 'update' ? 'อัปเดต' : 'ติดตั้ง'}: ${item.path}`);
  for (const warning of warnings) console.log(`เตือน: ${warning}`);
  if (options.dryRun) { console.log('Dry run: ไม่มีการเปลี่ยนแปลง'); return; }

  mkdirSync(target, { recursive: true });
  for (const item of changes) {
    const destination = ensureInside(target, item.path);
    writeFileSafely(target, item.path, item.content);
    if (item.path === 'initskill' && process.platform !== 'win32') chmodSync(destination, 0o755);
  }

  const manifest = { schemaVersion: 1, packageName: 'local-agent-skill-manager', files: nextFiles };
  writeFileSafely(target, INSTALL_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm ci --omit=dev'], { cwd: target, stdio: 'inherit' })
    : spawnSync('npm', ['ci', '--omit=dev'], { cwd: target, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ติดตั้ง dependencies ไม่สำเร็จ; ไฟล์ CLI ถูกวางไว้แล้ว ลองรัน npm ci ใน install directory อีกครั้ง');
  console.log('ติดตั้ง Local Agent Skill Manager สำเร็จ');
  console.log(`เปิด Terminal ใหม่แล้วใช้คำสั่ง: ${process.platform === 'win32' ? 'initskill' : `${join(target, 'initskill')}`}`);
}

try { main(); } catch (error) {
  console.error(`ติดตั้งไม่สำเร็จ: ${error.message}`);
  process.exitCode = 1;
}
