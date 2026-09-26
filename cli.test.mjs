import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from './file-safety.mjs';
import {
  buildGeneratedFiles,
  compileAgent,
  compileRules,
  diagnoseProject,
  discoverRules,
  getProfileRules,
  planCompiledRules,
  writeCompiledRules,
} from './cli.mjs';
import { applyWritePlan, formatLineDiff } from './file-safety.mjs';

const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const INSTALLER = fileURLToPath(new URL('./install.mjs', import.meta.url));
const UNINSTALLER = fileURLToPath(new URL('./uninstall.mjs', import.meta.url));

function tempRoot(t, prefix = 'agent-skills-test-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function rulesWith(content = '# Rule\n\nFollow it.') {
  return [{ title: 'Rule', category: 'core', relativePath: 'core/rule.md', content }];
}

test('discoverRules reads title and category using platform-independent paths', (t) => {
  const root = tempRoot(t);
  mkdirSync(join(root, 'backend'), { recursive: true });
  writeFileSync(join(root, 'backend', 'api.md'), '# API Rules\n\nKeep APIs stable.');
  const [rule] = discoverRules(root);
  assert.equal(rule.title, 'API Rules');
  assert.equal(rule.category, 'backend');
  assert.equal(rule.relativePath.replaceAll('\\', '/'), 'backend/api.md');
});

test('compileRules produces ordered, separated Markdown', () => {
  const rules = [
    { title: 'First', category: 'core', relativePath: 'core/first.md', content: '# First\n\nDo one thing.' },
    { title: 'Second', category: 'loop-test', relativePath: 'loop-test/second.md', content: '# Second\n\nDo another thing.' },
  ];
  const output = compileRules(rules);
  assert.ok(output.indexOf('## First') < output.indexOf('## Second'));
  assert.match(output, /---/);
  assert.doesNotMatch(output, /^# First$/m);
});

test('skill generation creates valid standard folders and doctor checks only Skill mode', (t) => {
  const root = tempRoot(t);
  const outputs = writeCompiledRules(rulesWith(), root, 'skill');
  assert.ok(outputs.some((path) => path.endsWith(join('.agents', 'skills', 'core-rule', 'SKILL.md'))));
  const content = readFileSync(join(root, '.agents', 'skills', 'core-rule', 'SKILL.md'), 'utf8');
  assert.match(content, /name: core-rule/);
  assert.match(content, /description:/);
  assert.equal(diagnoseProject(root, 'skill').every((check) => check.ok), true);
  assert.equal(diagnoseProject(root, 'auto').some((check) => check.path.includes('engineering-team')), false);
  assert.equal(diagnoseProject(root, 'agent').some((check) => !check.ok), true);
});

test('agent generation creates standard folders and a default Git policy', (t) => {
  const root = tempRoot(t);
  const outputs = writeCompiledRules(rulesWith(), root, 'agent');
  assert.ok(outputs.some((path) => path.endsWith(join('.agents', 'agents', 'engineering-team', 'agent.md'))));
  assert.match(readFileSync(join(root, '.agents', 'agents', 'engineering-team', 'agent.md'), 'utf8'), /name: engineering-team/);
  const workspaceRule = readFileSync(join(root, '.agents', 'rules', '00-engineering-team.md'), 'utf8');
  assert.match(workspaceRule, /^---\r?\ntrigger: model_decision/m);
  assert.ok(Buffer.byteLength(workspaceRule) < 24000);
  assert.equal(JSON.parse(readFileSync(join(root, '.agents', 'project', 'agent-manager-config.json'), 'utf8')).git.commitPolicy, 'ask');
  assert.equal(diagnoseProject(root, 'agent').every((check) => check.ok), true);
});

test('general agent workspace rule stays within Antigravity rule size limits', (t) => {
  const root = tempRoot(t);
  const rules = getProfileRules(discoverRules(), 'general');
  writeCompiledRules(rules, root, 'agent');
  const rulePath = join(root, '.agents', 'rules', '00-engineering-team.md');
  assert.ok(Buffer.byteLength(readFileSync(rulePath, 'utf8')) < 24000);
});

test('doctor rejects workspace rules without valid Antigravity frontmatter', (t) => {
  const root = tempRoot(t);
  writeCompiledRules(rulesWith(), root, 'agent');
  const rulePath = join(root, '.agents', 'rules', '00-engineering-team.md');
  writeFileSync(rulePath, '# Invalid rule\n\nThis is ignored by Antigravity.\n');
  assert.equal(diagnoseProject(root, 'agent').find((check) => check.path.endsWith('00-engineering-team.md')).ok, false);
});

test('compileAgent follows explicit policy configuration instead of forcing commits', () => {
  const output = compileAgent(rulesWith());
  assert.match(output, /นโยบาย commit ใน/);
  assert.doesNotMatch(output, /สร้าง checkpoint commit ก่อน handoff/);
  const guide = buildGeneratedFiles(rulesWith(), tmpdir(), 'skill').find((file) => file.relativePath === 'AGENTS.md').content;
  assert.match(guide, /ask before committing/);
});

test('existing user files are previewed and preserved unless overwrite is selected', (t) => {
  const root = tempRoot(t);
  const target = join(root, '.agents', 'skills', 'core-rule', 'SKILL.md');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, '# My custom skill\n\nDo not replace me.');

  const plan = planCompiledRules(rulesWith(), root, 'skill', { conflictPolicy: 'keep' });
  assert.equal(plan.entries.find((entry) => entry.key.endsWith('SKILL.md')).action, 'keep');
  applyWritePlan(plan, { dryRun: true });
  assert.match(readFileSync(target, 'utf8'), /Do not replace me/);

  const overwritePlan = planCompiledRules(rulesWith(), root, 'skill', { conflictPolicy: 'overwrite' });
  const result = applyWritePlan(overwritePlan, { backupStamp: 'test-backup' });
  assert.match(readFileSync(target, 'utf8'), /Apply this skill only/);
  assert.equal(result.backups.length, 1);
  assert.match(readFileSync(join(root, '.agent-skills-backups', 'test-backup', '.agents', 'skills', 'core-rule', 'SKILL.md'), 'utf8'), /Do not replace me/);
});

test('managed files update when unchanged and conflict when user edits them', (t) => {
  const root = tempRoot(t);
  writeCompiledRules(rulesWith(), root, 'skill');
  const skillPath = join(root, '.agents', 'skills', 'core-rule', 'SKILL.md');

  const safeUpdate = planCompiledRules(rulesWith('# Rule\n\nUpdated guidance.'), root, 'skill');
  assert.equal(safeUpdate.entries.find((entry) => entry.key.endsWith('SKILL.md')).action, 'update');
  applyWritePlan(safeUpdate);
  assert.match(readFileSync(skillPath, 'utf8'), /Updated guidance/);

  writeFileSync(skillPath, `${readFileSync(skillPath, 'utf8')}\n## My addition\n`);
  const conflict = planCompiledRules(rulesWith('# Rule\n\nThird version.'), root, 'skill');
  assert.equal(conflict.entries.find((entry) => entry.key.endsWith('SKILL.md')).action, 'conflict');
});

test('AGENTS.md managed block changes mode while user-authored text remains intact', (t) => {
  const root = tempRoot(t);
  writeFileSync(join(root, 'AGENTS.md'), '# My project notes\n\nKeep this text.');
  const first = planCompiledRules(rulesWith(), root, 'agent', { conflictPolicy: 'overwrite' });
  applyWritePlan(first);
  const second = planCompiledRules(rulesWith(), root, 'skill');
  assert.equal(second.entries.find((entry) => entry.key === 'AGENTS.md').action, 'update');
  applyWritePlan(second);
  const content = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.match(content, /Keep this text/);
  assert.match(content, /Antigravity skills/);
  assert.match(content, /Keep this text\.\r?\n\r?\n<!-- BEGIN LOCAL AGENT SKILL MANAGER -->/);
  assert.equal((content.match(/BEGIN LOCAL AGENT SKILL MANAGER/g) ?? []).length, 1);
});

test('malformed managed markers fail safely instead of appending another block', (t) => {
  const root = tempRoot(t);
  writeFileSync(join(root, 'AGENTS.md'), '<!-- BEGIN LOCAL AGENT SKILL MANAGER -->\nuser content');
  assert.throws(() => planCompiledRules(rulesWith(), root, 'skill'), /markers ซ้ำหรือไม่ครบ/);
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /user content/);
});

test('dry-run creates no project files and diff preview shows changed lines', (t) => {
  const root = tempRoot(t);
  const plan = planCompiledRules(rulesWith(), root, 'skill');
  applyWritePlan(plan, { dryRun: true });
  assert.equal(existsSync(join(root, '.agents')), false);
  assert.match(formatLineDiff('a\nb\nc', 'a\nB\nc'), /- b\n\+ B/);
});

test('duplicate output paths are rejected rather than silently overwriting a rule', (t) => {
  const root = tempRoot(t);
  const duplicateRules = [
    { title: 'One', category: 'core', relativePath: 'core/my_rule.md', content: '# One' },
    { title: 'Two', category: 'core', relativePath: 'core/my-rule.md', content: '# Two' },
  ];
  assert.throws(() => planCompiledRules(duplicateRules, root, 'skill'), /หลายกฎสร้างไฟล์ตำแหน่งเดียวกัน/);
});

test('general profile remains framework-agnostic', () => {
  const rules = discoverRules();
  const selected = getProfileRules(rules, 'general');
  assert.ok(selected.length >= 8);
  assert.equal(selected.some((rule) => rule.title === 'MongoDB Schema'), false);
  assert.equal(selected.some((rule) => rule.title === 'NestJS Conventions'), false);
  assert.equal(selected.some((rule) => rule.title === 'Next.js App Router'), false);
});

test('release lockfile matches package version and includes the supported runtime', () => {
  const packageInfo = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const shrinkwrap = JSON.parse(readFileSync(new URL('./npm-shrinkwrap.json', import.meta.url), 'utf8'));
  assert.equal(shrinkwrap.version, packageInfo.version);
  assert.equal(shrinkwrap.packages[''].version, packageInfo.version);
  assert.equal(shrinkwrap.packages[''].engines.node, packageInfo.engines.node);
});

test('CLI help, version, and non-interactive initialization have deterministic behavior', (t) => {
  const root = tempRoot(t);
  const help = spawnSync(process.execPath, [CLI, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--dry-run/);
  const version = spawnSync(process.execPath, [CLI, '--version'], { cwd: root, encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);
  const init = spawnSync(process.execPath, [
    CLI, 'init', '--mode', 'skill', '--profile', 'general', '--non-interactive', '--output-dir', root,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  assert.ok(existsSync(join(root, '.agents', 'skills')));
  const doctor = spawnSync(process.execPath, [CLI, 'doctor', '--mode', 'skill', '--json', '--output-dir', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  assert.equal(JSON.parse(doctor.stdout).ok, true);
});

test('doctor rejects malformed Skill metadata', (t) => {
  const root = tempRoot(t);
  writeCompiledRules(rulesWith(), root, 'skill');
  writeFileSync(join(root, '.agents', 'skills', 'core-rule', 'SKILL.md'), '---\nname: core-rule\n---\n# Missing description');
  assert.equal(diagnoseProject(root, 'skill').find((check) => check.path.endsWith('SKILL.md')).ok, false);
});

test('non-interactive conflicts fail closed, while explicit overwrite creates a backup', (t) => {
  const root = tempRoot(t);
  const first = spawnSync(process.execPath, [CLI, 'init', '--mode', 'skill', '--non-interactive', '--output-dir', root], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const skillPath = join(root, '.agents', 'skills', 'core-no-assumptions', 'SKILL.md');
  writeFileSync(skillPath, `${readFileSync(skillPath, 'utf8')}\n## User change\n`);

  const blocked = spawnSync(process.execPath, [CLI, 'init', '--mode', 'skill', '--non-interactive', '--output-dir', root], { encoding: 'utf8' });
  assert.equal(blocked.status, 3);
  assert.match(readFileSync(skillPath, 'utf8'), /User change/);

  const overwritten = spawnSync(process.execPath, [CLI, 'init', '--mode', 'skill', '--non-interactive', '--on-conflict', 'overwrite', '--output-dir', root], { encoding: 'utf8' });
  assert.equal(overwritten.status, 0, overwritten.stderr || overwritten.stdout);
  assert.doesNotMatch(readFileSync(skillPath, 'utf8'), /User change/);
  assert.ok(existsSync(join(root, '.agent-skills-backups')));
});

test('unknown arguments fail clearly instead of opening the interactive menu', (t) => {
  const root = tempRoot(t);
  const result = spawnSync(process.execPath, [CLI, '--nonsense'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /รู้จักคำสั่ง|ค่า|ผิดพลาด/);
  const unknownCommand = spawnSync(process.execPath, [CLI, 'surprise'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(unknownCommand.status, 0);
  assert.match(unknownCommand.stderr, /ไม่รู้จักคำสั่ง/);
});

test('generated policy can be changed explicitly and unrelated JSON settings survive', (t) => {
  const root = tempRoot(t);
  const configPath = join(root, '.agents', 'project', 'agent-manager-config.json');
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ locale: 'th', git: { commitPolicy: 'ask', sign: true } }, null, 2));
  const result = spawnSync(process.execPath, [CLI, 'config', 'git-policy', 'auto', '--yes', '--output-dir', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(config.git.commitPolicy, 'auto');
  assert.equal(config.git.sign, true);
  assert.equal(config.locale, 'th');
  assert.equal(readdirSync(join(root, '.agent-skills-backups')).length, 1);
});

test('changing the policy updates ownership metadata for a later safe refresh', (t) => {
  const root = tempRoot(t);
  writeCompiledRules(rulesWith(), root, 'agent');
  const result = spawnSync(process.execPath, [CLI, 'config', 'git-policy', 'auto', '--yes', '--output-dir', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = planCompiledRules(rulesWith(), root, 'agent', { commitPolicy: 'ask' });
  assert.equal(plan.entries.find((entry) => entry.key.endsWith('agent-manager-config.json')).action, 'update');
});

test('installer dry-run does not create an install directory', (t) => {
  const root = tempRoot(t);
  const target = join(root, 'new-install');
  const result = spawnSync(process.execPath, [INSTALLER, '--prefix', target, '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(target), false);
  assert.match(result.stdout, /Dry run/);
});

test('installer update preview preserves customized rules unless force is explicit', (t) => {
  const root = tempRoot(t);
  const target = join(root, 'install');
  const skillRelative = 'skills/core/no-assumptions.md';
  mkdirSync(join(target, 'skills', 'core'), { recursive: true });
  const customized = '# My own rule\n';
  writeFileSync(join(target, skillRelative), customized);
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'local-agent-skill-manager' }));
  writeFileSync(join(target, '.install-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    packageName: 'local-agent-skill-manager',
    files: { [skillRelative]: sha256('# Old shipped rule\n') },
  }));

  const safe = spawnSync(process.execPath, [INSTALLER, '--prefix', target, '--dry-run'], { encoding: 'utf8' });
  assert.equal(safe.status, 0, safe.stderr || safe.stdout);
  assert.match(safe.stdout, /เก็บไฟล์ที่มีการแก้ไขไว้/);
  assert.match(readFileSync(join(target, skillRelative), 'utf8'), /My own rule/);

  const forced = spawnSync(process.execPath, [INSTALLER, '--prefix', target, '--force', '--dry-run'], { encoding: 'utf8' });
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);
  assert.match(forced.stdout, /สำรอง: \.install-backups/);
  assert.match(readFileSync(join(target, skillRelative), 'utf8'), /My own rule/);
});

test('uninstaller removes only unchanged managed files and preserves user data', (t) => {
  const root = tempRoot(t);
  const managed = join(root, 'cli.mjs');
  const modified = join(root, 'modified-rule.md');
  const custom = join(root, 'custom-rule.md');
  mkdirSync(join(root, 'node_modules', 'sample'), { recursive: true });
  writeFileSync(managed, 'owned');
  writeFileSync(modified, 'user-edited');
  writeFileSync(custom, 'user-created');
  writeFileSync(join(root, '.install-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    packageName: 'local-agent-skill-manager',
    files: { 'cli.mjs': sha256('owned'), 'modified-rule.md': sha256('original') },
  }));
  const result = spawnSync(process.execPath, [UNINSTALLER, '--prefix', root, '--yes'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(managed), false);
  assert.equal(existsSync(modified), true);
  assert.equal(existsSync(custom), true);
  assert.equal(existsSync(join(root, 'node_modules')), false);
});
