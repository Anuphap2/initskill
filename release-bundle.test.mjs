import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { buildReleaseBundle } from './release-bundle.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BUILDER = join(ROOT, 'release-bundle.mjs');
const RUNTIME = ['cli.mjs', 'file-safety.mjs', 'skills-manager.mjs', 'release-bundle.mjs', 'install.mjs', 'uninstall.mjs',
  'install.ps1', 'uninstall.ps1', 'install.sh', 'uninstall.sh', 'initskill', 'initskill.cmd',
  'README.md', 'CHANGELOG.md', 'DISTRIBUTION.md'];

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'release-bundle-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceDir = join(root, 'source');
  mkdirSync(join(sourceDir, 'skills', 'core'), { recursive: true });
  for (const name of RUNTIME) writeFileSync(join(sourceDir, name), `// fixture ${name}\n`);
  writeFileSync(join(sourceDir, 'DISTRIBUTION.md'), readFileSync(join(ROOT, 'DISTRIBUTION.md')));
  writeFileSync(join(sourceDir, 'release-bundle.mjs'), readFileSync(BUILDER));
  // Lifecycle scripts must never execute, and the source package whitelist is incomplete.
  const pkg = { name: 'fixture-release', version: '1.2.3', private: true, type: 'module',
    bin: { initskill: './cli.mjs' }, files: ['cli.mjs'],
    scripts: { prepack: 'node -e "process.exit(99)"' } };
  writeFileSync(join(sourceDir, 'package.json'), JSON.stringify(pkg));
  writeFileSync(join(sourceDir, 'npm-shrinkwrap.json'), JSON.stringify({ name: pkg.name,
    version: pkg.version, lockfileVersion: 3, packages: { '': { name: pkg.name, version: pkg.version } } }));
  writeFileSync(join(sourceDir, 'skills', 'core', 'rule.md'), '# Rule\n');
  writeFileSync(join(sourceDir, '.env'), 'DO_NOT_DISTRIBUTE=secret');
  writeFileSync(join(sourceDir, 'cli.test.mjs'), '// excluded');
  mkdirSync(join(sourceDir, 'node_modules'));
  writeFileSync(join(sourceDir, 'node_modules', 'secret.txt'), 'excluded');
  mkdirSync(join(sourceDir, 'skills', 'node_modules'));
  writeFileSync(join(sourceDir, 'skills', 'node_modules', 'secret.md'), '# Excluded dependency content');
  writeFileSync(join(sourceDir, 'skills', '.hidden.md'), '# Excluded hidden content');
  return { root, sourceDir, output: join(root, 'bundle with spaces') };
}

// Read actual tar headers without relying on an installed tar command or new dependencies.
function unpack(buffer) {
  const tar = gunzipSync(buffer);
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0;
    const prefix = header.subarray(345, 500).toString().replace(/\0.*$/s, '');
    if (header[156] === 0 || header[156] === 48) {
      files.set(prefix ? `${prefix}/${name}` : name, tar.subarray(offset + 512, offset + 512 + size));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

test('dry run validates and plans without making output or temporary files', (t) => {
  const { root, sourceDir, output } = fixture(t);
  const before = readdirSync(root);
  const result = buildReleaseBundle(output, { sourceDir, dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.version, '1.2.3');
  assert.deepEqual(result.artifacts, ['fixture-release-1.2.3.tgz', 'INSTALL.md', 'SHA256SUMS']);
  assert.ok(result.packageFiles.includes('skills/core/rule.md'));
  assert.equal(existsSync(output), false);
  assert.deepEqual(readdirSync(root), before);
});

test('existing directories, files and protected source destinations are refused unchanged', (t) => {
  const { root, sourceDir, output } = fixture(t);
  mkdirSync(output);
  writeFileSync(join(output, 'user.txt'), 'keep me');
  const pkg = readFileSync(join(sourceDir, 'package.json'));
  for (const destination of [output, sourceDir, root, join(sourceDir, 'skills', 'release'),
    join(sourceDir, 'node_modules', 'release'), join(sourceDir, '.git', 'release')]) {
    assert.throws(() => buildReleaseBundle(destination, { sourceDir }), /existing|protected|source/i);
    assert.throws(() => buildReleaseBundle(destination, { sourceDir, dryRun: true }), /existing|protected|source/i);
  }
  const file = join(root, 'user-file');
  writeFileSync(file, 'also keep');
  assert.throws(() => buildReleaseBundle(file, { sourceDir }), /existing/i);
  assert.equal(readFileSync(join(output, 'user.txt'), 'utf8'), 'keep me');
  assert.equal(readFileSync(file, 'utf8'), 'also keep');
  assert.deepEqual(readFileSync(join(sourceDir, 'package.json')), pkg);
});

test('rejects symlinked output ancestors and package files', (t) => {
  const { root, sourceDir } = fixture(t);
  const link = join(root, 'linked');
  try { symlinkSync(sourceDir, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) return t.skip(`OS denies symlink creation: ${error.code}`);
    throw error;
  }
  assert.throws(() => buildReleaseBundle(join(link, 'bundle'), { sourceDir, dryRun: true }), /symbolic|symlink/i);
  rmSync(join(sourceDir, 'skills'), { recursive: true });
  symlinkSync(link, join(sourceDir, 'skills'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => buildReleaseBundle(join(root, 'bundle'), { sourceDir, dryRun: true }), /symbolic|symlink/i);
});

test('missing required modules and mismatched shrinkwrap fail before output is created', (t) => {
  const { sourceDir, output } = fixture(t);
  for (const name of ['cli.mjs', 'skills-manager.mjs', 'release-bundle.mjs']) {
    const original = readFileSync(join(sourceDir, name));
    rmSync(join(sourceDir, name));
    assert.throws(() => buildReleaseBundle(output, { sourceDir }), (error) => error.message.includes(name));
    assert.throws(() => buildReleaseBundle(output, { sourceDir, dryRun: true }), (error) => error.message.includes(name));
    assert.equal(existsSync(output), false);
    writeFileSync(join(sourceDir, name), original);
  }
  writeFileSync(join(sourceDir, 'npm-shrinkwrap.json'), '{"name":"other","version":"0.0.0"}');
  assert.throws(() => buildReleaseBundle(output, { sourceDir }), /shrinkwrap/i);
  assert.equal(existsSync(output), false);
});

test('actual npm pack includes the integration module, excludes secrets and checksums every sidecar', (t) => {
  const { root, sourceDir, output } = fixture(t);
  writeFileSync(join(sourceDir, 'skills-manager.mjs'), 'export const manager = true;\n');
  const pkg = readFileSync(join(sourceDir, 'package.json'));
  const result = buildReleaseBundle(output, { sourceDir });
  assert.equal(result.dryRun, false);
  assert.deepEqual(readdirSync(output).sort(), [...result.artifacts].sort());
  const archive = unpack(readFileSync(join(output, result.tarball)));
  assert.deepEqual([...archive.keys()].sort(), result.packageFiles.map((path) => `package/${path}`).sort());
  assert.equal(archive.get('package/skills-manager.mjs').toString(), 'export const manager = true;\n');
  const packedPackage = JSON.parse(archive.get('package/package.json'));
  assert.equal(packedPackage.private, true);
  assert.equal(packedPackage.license, undefined);
  assert.deepEqual(readFileSync(join(sourceDir, 'package.json')), pkg);
  const sums = readFileSync(join(output, 'SHA256SUMS'), 'utf8').trim().split('\n');
  assert.equal(sums.length, 2);
  for (const line of sums) {
    const [digest, name] = line.split('  ');
    assert.equal(digest, createHash('sha256').update(readFileSync(join(output, name))).digest('hex'));
  }
  const instructions = readFileSync(join(output, 'INSTALL.md'), 'utf8');
  assert.match(instructions, /node install\.mjs/);
  assert.match(instructions, /initskill init --target both --json/);
  assert.match(instructions, /initskill doctor --json/);
  assert.match(instructions, /SHA256SUMS/);
  assert.throws(() => buildReleaseBundle(output, { sourceDir }), /existing/i);
  assert.deepEqual(readdirSync(root).sort(), ['bundle with spaces', 'source']);
});

test('real package is distributable without tests, repository metadata or dependencies', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'release-real-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = buildReleaseBundle(join(root, 'bundle'));
  const archive = unpack(readFileSync(join(result.outputDir, result.tarball)));
  assert.ok(archive.has('package/cli.mjs'));
  assert.ok(archive.has('package/skills-manager.mjs'));
  assert.ok(archive.has('package/release-bundle.mjs'));
  assert.ok(archive.has('package/install.mjs'));
  assert.ok(archive.has('package/npm-shrinkwrap.json'));
  assert.ok(archive.has('package/DISTRIBUTION.md'));
  assert.ok([...archive.keys()].some((path) => path.startsWith('package/skills/')));
  assert.ok([...archive.keys()].every((path) => !/node_modules|\.git\/|\.test\.mjs/.test(path)));
  // Smoke-test the delivered installer without installing dependencies or touching the home directory.
  const extracted = join(root, 'extracted');
  for (const [name, content] of archive) {
    const destination = join(extracted, name);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
  const installed = join(root, 'install-preview');
  const smoke = spawnSync(process.execPath, [join(extracted, 'package', 'install.mjs'),
    '--prefix', installed, '--dry-run'], { encoding: 'utf8' });
  assert.equal(smoke.status, 0, smoke.stderr);
  assert.match(smoke.stdout, /skills-manager\.mjs/);
  assert.match(smoke.stdout, /release-bundle\.mjs/);
  assert.match(smoke.stdout, /DISTRIBUTION\.md/);
  assert.equal(existsSync(installed), false);
  // The packaged builder must also work after extraction, without source-checkout files.
  const repack = spawnSync(process.execPath, [join(extracted, 'package', 'release-bundle.mjs'),
    '--output-dir', join(root, 'repacked')], { encoding: 'utf8' });
  assert.equal(repack.status, 0, repack.stderr);
  const repacked = JSON.parse(repack.stdout);
  assert.deepEqual(repacked.packageFiles, result.packageFiles);
  assert.ok(existsSync(join(repacked.outputDir, repacked.tarball)));
});

test('unexpected npm pack metadata fails cleanly without leaving output or staging/cache', (t) => {
  const { root, sourceDir, output } = fixture(t);
  // Inject a subprocess response to exercise the pack-result boundary. Happy paths use real npm.
  const npmCli = join(root, 'npm-cli.js');
  writeFileSync(npmCli, `process.stdout.write(JSON.stringify([{ filename: 'fixture-release-1.2.3.tgz', files: [] }]));`);
  const previous = process.env.npm_execpath;
  process.env.npm_execpath = npmCli;
  try { assert.throws(() => buildReleaseBundle(output, { sourceDir }), /whitelist/); }
  finally {
    if (previous === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previous;
  }
  assert.equal(existsSync(output), false);
  assert.deepEqual(readdirSync(root).sort(), ['npm-cli.js', 'source']);
});

test('CLI prints JSON for dry run and rejects missing or unknown arguments', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'release-cli-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'new-bundle');
  const preview = spawnSync(process.execPath, [BUILDER, '--output-dir', output, '--dry-run'], { encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).dryRun, true);
  assert.equal(existsSync(output), false);
  for (const args of [['--output-dir'], ['--output-dir', '--dry-run'], ['--publish'], ['--output-dir', '']]) {
    const bad = spawnSync(process.execPath, [BUILDER, ...args], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /output-dir|Unknown/);
  }
});
