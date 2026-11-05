import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { sha256 } from './file-safety.mjs';
import { createProjectSkill, validateProjectSkills } from './skills-manager.mjs';

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'project-skills-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

const options = (projectDir, extra = {}) => ({
  projectDir, name: 'review-api', description: 'Review API compatibility and document risks.', ...extra,
});
const skill = (metadata = 'name: review-api\ndescription: Review API compatibility.', body = '# Review\n\nInspect public interfaces.') =>
  `---\n${metadata}\n---\n${body}\n`;

test('creates a local skill with metadata, hash and an explicitly unfinished scaffold', (t) => {
  const root = tempRoot(t);
  const result = createProjectSkill(options(root));
  assert.equal(result.path, join(root, '.agents', 'skills', 'review-api', 'SKILL.md'));
  assert.equal(result.backup, null);
  assert.equal(result.dryRun, false);
  assert.equal(result.hash, sha256(readFileSync(result.path)));
  assert.match(readFileSync(result.path, 'utf8'), /draft|scaffold|review before use/i);
  const [record] = validateProjectSkills(root);
  assert.equal(record.path, result.path);
  assert.equal(record.ok, true);
  assert.deepEqual(record.errors, []);
  assert.equal(record.name, 'review-api');
  assert.equal(record.description, options(root).description);
  assert.equal(record.hash, result.hash);
  assert.equal(existsSync(join(root, '.agent-skill-manager.json')), false);
});

test('preserves custom bodies, escaped descriptions and non-English text', (t) => {
  const root = tempRoot(t);
  const body = '# ตรวจสอบ\n\nตรวจสอบ API ก่อนใช้งาน\n';
  const result = createProjectSkill(options(root, { body, description: 'ตรวจสอบ "API": compatibility.' }));
  assert.ok(readFileSync(result.path, 'utf8').endsWith(body));
  assert.equal(validateProjectSkills(root)[0].description, 'ตรวจสอบ "API": compatibility.');
});

test('accepts complete source documents with plain, single-quoted or double-quoted fields', (t) => {
  const root = tempRoot(t);
  for (const [index, metadata] of [
    'name: review-api\ndescription: Review APIs # inline comment',
    "name: 'review-api'\ndescription: 'Review API''s behavior: carefully.'",
    'name: "review-api"\ndescription: "Review \\"API\\" behavior." # comment',
  ].entries()) {
    const projectDir = join(root, `project-${index}`);
    mkdirSync(projectDir);
    const content = skill(metadata).replaceAll('\n', '\r\n');
    const sourceFile = put(root, `source-${index}.md`, content);
    const result = createProjectSkill(options(projectDir, { sourceFile }));
    assert.equal(readFileSync(result.path, 'utf8'), content);
    assert.equal(result.hash, sha256(content));
    assert.equal(validateProjectSkills(projectDir)[0].ok, true);
  }
});

test('discovers nested local skills and reports mismatches, missing files and bad metadata', (t) => {
  const root = tempRoot(t);
  put(root, '.agents/skills/team/review-api/SKILL.md', skill());
  put(root, '.agents/skills/wrong-folder/SKILL.md', skill());
  put(root, '.agents/skills/invalid/SKILL.md', skill('name: invalid'));
  mkdirSync(join(root, '.agents', 'skills', 'missing'));
  put(root, '.agents/skills/team/review-api/resources/reference.md', 'Resource, not a skill.');
  put(root, '.agents/skills/team/review-api/scripts/do-not-run.mjs', 'throw new Error("Never execute this");');
  const reports = validateProjectSkills(root);
  assert.equal(reports.length, 4);
  assert.equal(reports.find((r) => r.path.includes(join('team', 'review-api'))).ok, true);
  assert.match(reports.find((r) => r.path.includes('wrong-folder')).errors.join(' '), /name.*folder/i);
  assert.match(reports.find((r) => r.path.includes(join('skills', 'invalid'))).errors.join(' '), /description/i);
  assert.match(reports.find((r) => r.path.includes(join('skills', 'missing'))).errors.join(' '), /missing/i);
});

test('an absent skills directory has no validation records and does not create files', (t) => {
  const root = tempRoot(t);
  assert.deepEqual(validateProjectSkills(root), []);
  assert.deepEqual(readdirSync(root), []);
});

test('updates require both overwrite and matching hash, back up exact bytes and preserve resources', (t) => {
  const root = tempRoot(t);
  const first = createProjectSkill(options(root, { body: '# Original\n\nReview interfaces.' }));
  const original = readFileSync(first.path);
  const resource = put(root, '.agents/skills/review-api/resources/example.json', '{"keep":true}');
  const guide = put(root, 'AGENTS.md', '# User guide\n');
  const manifest = put(root, '.agent-skill-manager.json', 'User-owned unrelated data');
  for (const extra of [{}, { overwrite: true }, { expectedHash: first.hash }]) {
    assert.throws(() => createProjectSkill(options(root, extra)), /conflict|overwrite|expectedHash/i);
    assert.deepEqual(readFileSync(first.path), original);
    assert.equal(existsSync(join(root, '.agent-skills-backups')), false);
  }
  const updated = createProjectSkill(options(root, {
    overwrite: true, expectedHash: first.hash, body: '# Revised\n\nInspect compatibility and risks.',
  }));
  assert.ok(updated.backup.startsWith(join(root, '.agent-skills-backups')));
  assert.deepEqual(readFileSync(updated.backup), original);
  assert.equal(updated.hash, sha256(readFileSync(updated.path)));
  assert.notEqual(updated.hash, first.hash);
  assert.equal(readFileSync(resource, 'utf8'), '{"keep":true}');
  assert.equal(readFileSync(guide, 'utf8'), '# User guide\n');
  assert.equal(readFileSync(manifest, 'utf8'), 'User-owned unrelated data');
  assert.throws(() => createProjectSkill(options(root, { overwrite: true, expectedHash: first.hash })), /integrity|stale|hash/i);
  assert.equal(readFileSync(updated.path, 'utf8').includes('Revised'), true);
});

test('an expected hash cannot recreate a deleted skill, and identical content still requires authorization', (t) => {
  const root = tempRoot(t);
  assert.throws(() => createProjectSkill(options(root, { overwrite: true, expectedHash: 'a'.repeat(64) })), /integrity|missing/i);
  const first = createProjectSkill(options(root));
  assert.throws(() => createProjectSkill(options(root)), /conflict/i);
  const result = createProjectSkill(options(root, { overwrite: true, expectedHash: first.hash }));
  assert.equal(result.hash, first.hash);
  assert.ok(result.backup);
  rmSync(first.path);
  assert.throws(() => createProjectSkill(options(root, { overwrite: true, expectedHash: first.hash })), /integrity|missing/i);
  assert.equal(existsSync(first.path), false);
});

test('adapted updates preserve byte-exact backups even when timestamps collide', (t) => {
  const root = tempRoot(t);
  const content = `\ufeff${skill().replaceAll('\n', '\r\n')}`;
  const sourceFile = put(root, 'source.md', content);
  const first = createProjectSkill(options(root, { sourceFile }));
  assert.equal(first.hash, sha256(Buffer.from(content)));
  t.mock.method(Date.prototype, 'toISOString', () => '2026-10-06T12:00:00.000Z');
  const second = createProjectSkill(options(root, { overwrite: true, expectedHash: first.hash, body: '# Second\n\nInspect public APIs.' }));
  const secondBytes = readFileSync(second.path);
  writeFileSync(sourceFile, skill(undefined, '# Third\n\nInspect changes.'));
  const third = createProjectSkill(options(root, { sourceFile, overwrite: true, expectedHash: second.hash }));
  assert.notEqual(second.backup, third.backup);
  assert.deepEqual(readFileSync(second.backup), Buffer.from(content));
  assert.deepEqual(readFileSync(third.backup), secondBytes);
  assert.deepEqual(readFileSync(third.path), readFileSync(sourceFile));
});

test('dry-run validates creations and updates without creating a directory or backup', (t) => {
  const root = tempRoot(t);
  const preview = createProjectSkill(options(root, { dryRun: true }));
  assert.equal(preview.dryRun, true);
  assert.equal(preview.backup, null);
  assert.deepEqual(readdirSync(root), []);
  const first = createProjectSkill(options(root));
  assert.equal(first.hash, preview.hash);
  const original = readFileSync(first.path);
  const update = createProjectSkill(options(root, { dryRun: true, overwrite: true, expectedHash: first.hash, body: '# Revised\n\nCheck changes.' }));
  assert.equal(update.dryRun, true);
  assert.equal(update.backup, null);
  assert.notEqual(update.hash, first.hash);
  assert.deepEqual(readFileSync(first.path), original);
  assert.equal(existsSync(join(root, '.agent-skills-backups')), false);
  assert.throws(() => createProjectSkill(options(root, { dryRun: true, overwrite: true, expectedHash: '0'.repeat(64) })), /integrity|hash/i);
});

test('rejects invalid inputs and traversal names without writing', (t) => {
  const root = tempRoot(t);
  for (const name of ['', '../escape', '..', 'a/b', 'a\\b', 'UPPER', '-bad', 'bad-', 'bad--name', 'a'.repeat(65), 'con', 'nul']) {
    assert.throws(() => createProjectSkill(options(root, { name })), /name/i, name);
  }
  for (const extra of [
    { description: '' }, { description: false }, { description: 'bad\nmetadata' },
    { body: '' }, { body: ' \n ' }, { body: {} }, { dryRun: 'true' }, { overwrite: 'true' },
    { expectedHash: 'invalid' }, { sourceFile: 42 }, { sourceFile: 'source.md', body: 'ambiguous' },
  ]) assert.throws(() => createProjectSkill(options(root, extra)));
  assert.deepEqual(readdirSync(root), []);
  const longest = createProjectSkill(options(root, { name: 'a'.repeat(64), dryRun: true }));
  assert.ok(longest.path.includes('a'.repeat(64)));
});

test('rejects malformed complete sources before creating destination files', (t) => {
  const root = tempRoot(t);
  const malformed = [
    '# No frontmatter', '---\nname: review-api\ndescription: Review API',
    skill('description: Review APIs.'), skill('name: review-api'),
    skill('name: review-api\ndescription: ""'), skill('name: review-api\ndescription: null'),
    skill('name: review-api\ndescription: false'), skill('name: review-api\ndescription: 123'),
    skill('name: review-api\ndescription: 0xFF'), skill('name: review-api\ndescription: - list'),
    skill('name: review-api\ndescription: >\n  unsupported block scalar'),
    skill('name: review-api\ndescription: Review API\nmetadata:\n  nested: unsupported'),
    skill('name: review-api\ndescription: [review]'), skill('name: review-api\ndescription: {task: review}'),
    skill('name: review-api\ndescription: "unterminated'),
    skill('name: review-api\ndescription: Review: API'),
    skill('name: review-api\nname: other\ndescription: Review API'),
    skill('name: different\ndescription: Review API'), skill(undefined, '   '),
    Buffer.from([0xff, 0xfe]),
  ];
  const sourceFile = join(root, 'source.md');
  for (const content of malformed) {
    writeFileSync(sourceFile, content);
    assert.throws(() => createProjectSkill(options(root, { sourceFile })), /metadata|frontmatter|name|description|body|UTF-8/i);
    assert.equal(existsSync(join(root, '.agents')), false);
  }
});

test('invalid adapted source cannot change or back up an existing skill', (t) => {
  const root = tempRoot(t);
  const first = createProjectSkill(options(root));
  const sourceFile = put(root, 'bad.md', skill('name: review-api'));
  assert.throws(() => createProjectSkill(options(root, { sourceFile, overwrite: true, expectedHash: first.hash })), /description/i);
  assert.equal(sha256(readFileSync(first.path)), first.hash);
  assert.equal(existsSync(join(root, '.agent-skills-backups')), false);
});

test('rejects symlink escapes in destinations, discovery, sources and backup directories', (t) => {
  const root = tempRoot(t);
  const outside = tempRoot(t);
  const linkedProject = join(root, 'linked-project');
  symlinkSync(outside, linkedProject, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createProjectSkill(options(linkedProject, { dryRun: true })), /symbolic|symlink/i);
  for (const linkAt of ['.agents', '.agents/skills', '.agents/skills/review-api']) {
    const projectDir = mkdtempSync(join(root, 'case-'));
    mkdirSync(dirname(join(projectDir, linkAt)), { recursive: true });
    symlinkSync(outside, join(projectDir, linkAt), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => createProjectSkill(options(projectDir)), /symbolic|symlink/i);
    assert.throws(() => createProjectSkill(options(projectDir, { dryRun: true })), /symbolic|symlink/i);
    assert.ok(validateProjectSkills(projectDir).some((r) => !r.ok && /symbolic|symlink/i.test(r.errors.join(' '))));
  }
  const original = createProjectSkill(options(root));
  symlinkSync(outside, join(root, '.agent-skills-backups'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createProjectSkill(options(root, { overwrite: true, expectedHash: original.hash })), /symbolic|symlink/i);
  assert.equal(sha256(readFileSync(original.path)), original.hash);
  assert.deepEqual(readdirSync(outside), []);
  const sourceDir = join(root, 'source-link');
  symlinkSync(outside, sourceDir, process.platform === 'win32' ? 'junction' : 'dir');
  put(outside, 'source.md', skill());
  assert.throws(() => createProjectSkill(options(root, { sourceFile: join(sourceDir, 'source.md'), dryRun: true })), /symbolic|symlink/i);
});

test('rejects dangling destination links and linked SKILL.md files without following them', (t) => {
  const root = tempRoot(t);
  const outside = tempRoot(t);
  const target = join(root, '.agents', 'skills', 'review-api', 'SKILL.md');
  mkdirSync(dirname(target), { recursive: true });
  // File symlinks require Developer Mode or administrator rights on Windows.
  try {
    symlinkSync(join(outside, 'missing.md'), target, 'file');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      t.skip('Windows file symlinks require Developer Mode or administrator rights.');
      return;
    }
    throw error;
  }
  assert.throws(() => createProjectSkill(options(root, { dryRun: true })), /symbolic|symlink/i);
  assert.equal(validateProjectSkills(root)[0].ok, false);
  assert.equal(existsSync(join(outside, 'missing.md')), false);
});

test('rejects dangling directory symlinks including Windows junctions', (t) => {
  const root = tempRoot(t);
  const outside = tempRoot(t);
  const folder = join(root, '.agents', 'skills', 'review-api');
  mkdirSync(dirname(folder), { recursive: true });
  const missing = join(outside, 'missing');
  symlinkSync(missing, folder, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createProjectSkill(options(root, { dryRun: true })), /symbolic|symlink/i);
  assert.equal(validateProjectSkills(root)[0].ok, false);
  assert.equal(existsSync(missing), false);
});
