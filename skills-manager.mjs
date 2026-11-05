import { randomUUID } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, parse, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { backupExistingFile, sha256, writeFileSafely } from './file-safety.mjs';

const SKILLS_PATH = join('.agents', 'skills');
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const decoder = new TextDecoder('utf-8', { fatal: true });

function validateName(name) {
  if (typeof name !== 'string' || name.length > 64 || !NAME_PATTERN.test(name) || RESERVED_NAME.test(name)) {
    throw new Error('Invalid name: use at most 64 lowercase letters, digits and single hyphens; no reserved device names.');
  }
}

function validateDescription(description) {
  if (typeof description !== 'string' || !description.trim() || /[\u0000-\u001f\u007f]/.test(description)) {
    throw new Error('Invalid description metadata: a nonempty single-line string is required.');
  }
}

function pathString(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    throw new Error(`Invalid ${label}: a nonempty filesystem path is required.`);
  }
  return resolve(value);
}

function isDarwinSystemLink(path) {
  return process.platform === 'darwin' && (path === '/var' || path === '/tmp' || path === '/etc');
}

// The write helpers recheck links before writing. Reads and dry runs also need
// protection, including project/source ancestors and dangling symbolic links.
function inspectPath(path) {
  const absolute = resolve(path);
  const anchor = parse(absolute).root;
  let current = anchor;
  let stat;
  const parts = relative(anchor, absolute).split(sep).filter(Boolean);
  for (let index = -1; index < parts.length; index += 1) {
    if (index >= 0) current = join(current, parts[index]);
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      if (isDarwinSystemLink(current)) {
        stat = statSync(current);
      } else {
        throw new Error(`Unsafe symbolic link in path: ${current}`);
      }
    }
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`Path ancestor is not a directory: ${current}`);
    }
  }
  return stat;
}

function projectRoot(projectDir) {
  const root = pathString(projectDir, 'projectDir');
  if (!inspectPath(root)?.isDirectory()) throw new Error(`Project directory is missing or not a directory: ${root}`);
  return root;
}

function decode(bytes, path) {
  try {
    const content = decoder.decode(bytes);
    if (content.includes('\0')) throw new Error('NUL character');
    return content;
  } catch {
    throw new Error(`Invalid UTF-8 skill content: ${path}`);
  }
}

function readRegularFile(path) {
  if (!inspectPath(path)?.isFile()) throw new Error(`Skill file is missing or not a regular file: ${path}`);
  return readFileSync(path);
}

// Intentionally bounded frontmatter, not a partial general-purpose YAML loader:
// flat fields with plain, YAML single-quoted, or JSON-compatible double-quoted
// strings and optional comments. Unsupported structures fail explicitly.
function parseScalar(raw, field) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    const match = value.match(/^("(?:[^"\\]|\\.)*")(?:\s+#.*)?\s*$/);
    if (!match) throw new Error(`Invalid quoted ${field} metadata.`);
    try { return JSON.parse(match[1]); } catch { throw new Error(`Invalid quoted ${field} metadata.`); }
  }
  if (value.startsWith("'")) {
    const match = value.match(/^'((?:[^']|'')*)'(?:\s+#.*)?\s*$/);
    if (!match) throw new Error(`Invalid quoted ${field} metadata.`);
    return match[1].replaceAll("''", "'");
  }
  const plain = value.replace(/(?:^|\s+)#.*$/, '').trim();
  if (!plain || /^[\[\]{}!&*|>@`%]/.test(plain) || /^(?:[-?:]\s|:)/.test(plain) || /:\s|:$/.test(plain)
    || /^(?:null|true|false|~|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?|[-+]?0(?:x[\da-f]+|o[0-7]+|b[01]+)|[-+]?\.(?:inf|nan))$/i.test(plain)) {
    throw new Error(`Invalid ${field} metadata: use a plain or quoted string (quote YAML scalars).`);
  }
  return plain;
}

function validateDocument(bytes, folder, path) {
  const content = decode(bytes, path);
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trimEnd() !== '---') throw new Error(`Missing opening frontmatter delimiter: ${path}`);
  const end = lines.findIndex((line, index) => index > 0 && line.trimEnd() === '---');
  if (end < 0) throw new Error(`Missing closing frontmatter delimiter: ${path}`);
  const fields = new Map();
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!match) throw new Error(`Invalid or unsupported frontmatter metadata: ${path}`);
    const [, field, raw] = match;
    if (fields.has(field)) throw new Error(`Duplicate ${field} metadata: ${path}`);
    fields.set(field, parseScalar(raw, field));
  }
  const name = fields.get('name');
  const description = fields.get('description');
  validateName(name);
  validateDescription(description);
  if (name !== folder) throw new Error(`Skill name "${name}" must match folder name "${folder}": ${path}`);
  if (!lines.slice(end + 1).join('\n').trim()) throw new Error(`Skill body must not be empty: ${path}`);
  return { name, description, hash: sha256(bytes) };
}

function defaultBody(name, description) {
  return `# ${name}\n\nDraft scaffold: review and adapt the task-specific steps before use.\n\n`
    + `## Scope\n\n${description}\n\n`
    + '## Inputs\n\nIdentify the requested outcome, relevant project files, constraints, and acceptance criteria.\n\n'
    + '## Procedure\n\n1. Read the applicable project instructions and relevant existing examples.\n'
    + '2. Resolve missing facts and agree on the files and actions in scope.\n'
    + '3. Perform the task using the project conventions, preserving unrelated user work.\n'
    + '4. Verify the acceptance criteria with appropriate checks and inspect the result.\n\n'
    + '## Verification and output\n\nAdd task-specific checks and examples before relying on this scaffold. '
    + 'Report the result, evidence, uncertainties, and any unfinished work; do not claim checks were run without evidence.\n';
}

function existingBytes(path) {
  const stat = inspectPath(path);
  if (!stat) return null;
  if (!stat.isFile()) throw new Error(`Skill destination is not a regular file: ${path}`);
  return readFileSync(path);
}

function checkIntegrity(path, expectedHash) {
  const current = existingBytes(path);
  if (current === null || sha256(current) !== expectedHash) {
    throw new Error(`Integrity error: missing file or stale expectedHash for ${path}`);
  }
  return current;
}

/**
 * Create/adapt a project-local skill. Names are validated, never slugged.
 * sourceFile supplies the complete document (including its description);
 * description remains a required valid input. body and sourceFile are exclusive.
 * Returns { path, hash, backup, dryRun }; backup is null if no backup was written.
 * Existing files always require overwrite:true and their current byte SHA-256.
 */
export function createProjectSkill({ projectDir, name, description, body, sourceFile, expectedHash, dryRun = false, overwrite = false } = {}) {
  validateName(name);
  validateDescription(description);
  if (typeof dryRun !== 'boolean' || typeof overwrite !== 'boolean') throw new Error('dryRun and overwrite must be booleans.');
  if (expectedHash !== undefined && (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash))) {
    throw new Error('Invalid expectedHash: a lowercase SHA-256 hex digest is required.');
  }
  if (body !== undefined && (typeof body !== 'string' || !body.trim())) throw new Error('Skill body must be a nonempty string.');
  if (sourceFile !== undefined && body !== undefined) throw new Error('Supply either body or sourceFile, not both.');

  const root = projectRoot(projectDir);
  const relativePath = join(SKILLS_PATH, name, 'SKILL.md');
  const path = join(root, relativePath);
  const content = sourceFile === undefined
    ? Buffer.from(`---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n\n${body ?? defaultBody(name, description)}`, 'utf8')
    : readRegularFile(pathString(sourceFile, 'sourceFile'));
  const { hash } = validateDocument(content, name, sourceFile ?? path);
  const current = existingBytes(path);
  if (current !== null && (!overwrite || expectedHash === undefined)) {
    throw new Error(`Skill conflict: ${path} already exists; overwrite:true and matching expectedHash are required.`);
  }
  if (expectedHash !== undefined) checkIntegrity(path, expectedHash);
  if (current !== null) {
    const backupStat = inspectPath(join(root, '.agent-skills-backups'));
    if (backupStat && !backupStat.isDirectory()) throw new Error('Backup destination is not a directory.');
  }
  if (dryRun) return { path, hash, backup: null, dryRun: true };

  let backup = null;
  if (current !== null) {
    const latest = checkIntegrity(path, expectedHash);
    // The helper's timestamp has millisecond precision. A unique subfolder
    // prevents two fast updates from replacing an earlier durable backup.
    backup = backupExistingFile(root, join(randomUUID(), relativePath), latest);
    checkIntegrity(path, expectedHash);
  } else if (existingBytes(path) !== null) {
    throw new Error(`Integrity error: destination appeared during creation: ${path}`);
  }
  writeFileSafely(root, relativePath, content);
  if (sha256(readRegularFile(path)) !== hash) throw new Error(`Integrity error: written content hash differs: ${path}`);
  return { path, hash, backup, dryRun: false };
}

/**
 * Recursively inspect local SKILL.md documents without executing their content.
 * Returns sorted { path, ok, errors, name?, description?, hash? } records.
 * A missing skills tree is empty; unreadable/unsafe paths are failed records.
 * Top-level directories may group nested skills. Resource directories need not
 * contain SKILL.md; a top-level directory containing none is reported as missing.
 */
export function validateProjectSkills(projectDir) {
  const records = [];
  const failure = (path, error) => records.push({ path, ok: false, errors: [error.message] });
  let root;
  let skillsRoot;
  try {
    root = projectRoot(projectDir);
    skillsRoot = join(root, SKILLS_PATH);
    const stat = inspectPath(skillsRoot);
    if (!stat) return [];
    if (!stat.isDirectory()) throw new Error(`Skills path is not a directory: ${skillsRoot}`);
  } catch (error) {
    failure(skillsRoot ?? (typeof projectDir === 'string' ? resolve(projectDir) : String(projectDir)), error);
    return records;
  }

  function visit(directory) {
    let found = 0;
    let entries;
    try {
      if (!inspectPath(directory)?.isDirectory()) throw new Error(`Skill directory is missing: ${directory}`);
      entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      failure(directory, error);
      return found;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      try {
        const stat = inspectPath(path);
        if (entry.name === 'SKILL.md') {
          found += 1;
          const metadata = validateDocument(readRegularFile(path), basename(dirname(path)), path);
          records.push({ path, ok: true, errors: [], ...metadata });
        } else if (stat?.isDirectory()) {
          const before = records.length;
          const nested = visit(path);
          found += nested;
          if (directory === skillsRoot && nested === 0 && records.length === before) {
            failure(join(path, 'SKILL.md'), new Error(`Missing SKILL.md in local skill directory: ${path}`));
          }
        }
      } catch (error) {
        failure(path, error);
      }
    }
    return found;
  }
  visit(skillsRoot);
  return records.sort((a, b) => a.path.localeCompare(b.path));
}
