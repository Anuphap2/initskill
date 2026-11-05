#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, readdirSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REQUIRED_FILES = [
  'package.json', 'cli.mjs', 'file-safety.mjs', 'skills-manager.mjs', 'release-bundle.mjs', 'install.mjs', 'uninstall.mjs',
  'install.ps1', 'uninstall.ps1', 'install.sh', 'uninstall.sh', 'initskill', 'initskill.cmd',
  'npm-shrinkwrap.json', 'README.md', 'CHANGELOG.md', 'DISTRIBUTION.md',
];
const OPTIONAL_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'NOTICE'];
const PROTECTED_DIRS = ['skills', 'node_modules', '.git', '.agents', '.codex'];

function statIfPresent(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// lstat also detects dangling links; checking only existsSync would miss them.
function assertNoLinks(path) {
  for (let current = resolve(path);; current = dirname(current)) {
    if (statIfPresent(current)?.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${current}`);
    if (current === dirname(current)) break;
  }
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

function validateOutput(output, source) {
  assertNoLinks(output);
  const home = resolve(homedir());
  if (inside(output, source) || (inside(output, home) && inside(home, output)) || output === dirname(output)) {
    throw new Error('Refusing protected destination: source directory, its ancestor, home or filesystem root');
  }
  for (const directory of PROTECTED_DIRS) {
    if (inside(join(source, directory), output)) throw new Error(`Refusing protected source destination: ${directory}`);
  }
  if (statIfPresent(output)) throw new Error(`Refusing existing destination: ${output}; choose a new directory`);
  if (!statIfPresent(dirname(output))?.isDirectory()) {
    throw new Error(`Output parent must already be an existing directory: ${dirname(output)}`);
  }
}

function sourceSnapshot(source) {
  assertNoLinks(source);
  const files = new Map();
  function add(path) {
    const absolute = join(source, path);
    assertNoLinks(absolute);
    if (!statIfPresent(absolute)?.isFile()) throw new Error(`Missing regular package file: ${path}`);
    files.set(path, readFileSync(absolute));
  }
  for (const path of REQUIRED_FILES) add(path);
  for (const path of OPTIONAL_FILES) if (statIfPresent(join(source, path))) add(path);
  function skills(path) {
    const absolute = join(source, path);
    assertNoLinks(absolute);
    if (!statIfPresent(absolute)?.isDirectory()) throw new Error(`Missing skills directory: ${path}`);
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link in package: ${child}`);
      if (entry.name.startsWith('.') || PROTECTED_DIRS.includes(entry.name)) continue;
      if (entry.isDirectory()) skills(child);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) add(child);
    }
  }
  skills('skills');
  if (![...files.keys()].some((path) => path.startsWith('skills/'))) throw new Error('No builtin Markdown skills found');
  const pkg = JSON.parse(files.get('package.json').toString());
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(pkg.name ?? '')
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(pkg.version ?? '')) {
    throw new Error('Package name or version is invalid for a release filename');
  }
  const lock = JSON.parse(files.get('npm-shrinkwrap.json').toString());
  if (lock.name !== pkg.name || lock.version !== pkg.version
    || lock.packages?.['']?.name !== pkg.name || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('npm-shrinkwrap.json must match package name and version, including its root package');
  }
  // Only the temporary package gets an expanded whitelist. Source metadata stays untouched.
  const packageFiles = [...files.keys()].sort();
  files.set('package.json', Buffer.from(`${JSON.stringify({ ...pkg, files: packageFiles }, null, 2)}\n`));
  return { files, packageFiles, pkg };
}

function npmPack(stage, artifacts, cache) {
  const args = ['pack', '--json', '--ignore-scripts', '--offline', '--cache', cache,
    '--pack-destination', artifacts];
  // Run npm's JS entrypoint directly where available, avoiding shell interpolation on Windows.
  const candidates = [process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')];
  const npmCli = candidates.find((path) => path && path.endsWith('npm-cli.js') && existsSync(path));
  let result;
  const options = { cwd: stage, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: cache, npm_config_ignore_scripts: 'true',
      npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false',
      npm_config_update_notifier: 'false' } };
  if (npmCli) result = spawnSync(process.execPath, [npmCli, ...args], options);
  else if (process.platform === 'win32') throw new Error('Cannot locate npm-cli.js beside Node; install Node with npm');
  else result = spawnSync('npm', args, options);
  if (result.error || result.status !== 0) {
    throw new Error(`npm pack failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  const packed = JSON.parse(result.stdout);
  if (!Array.isArray(packed) || packed.length !== 1) throw new Error('npm pack returned an unexpected package count');
  return packed[0];
}

/** Build a local npm tarball and verified-install sidecars; never publish or commit. */
export function buildReleaseBundle(outputDir = join(ROOT, 'dist'), { dryRun = false, sourceDir = ROOT } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node.js 20 or later is required');
  if (typeof outputDir !== 'string' || !outputDir.trim()) throw new Error('--output-dir must be a nonempty path');
  const source = resolve(sourceDir);
  const output = resolve(outputDir);
  validateOutput(output, source);
  const { files, packageFiles, pkg } = sourceSnapshot(source);
  const tarball = `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`;
  const result = { outputDir: output, packageName: pkg.name, version: pkg.version, dryRun: Boolean(dryRun),
    tarball, artifacts: [tarball, 'INSTALL.md', 'SHA256SUMS'], packageFiles };
  if (dryRun) return result;

  const temporary = mkdtempSync(join(dirname(output), '.release-bundle-'));
  const created = [];
  let ownsOutput = false;
  try {
    const stage = join(temporary, 'package');
    const artifacts = join(temporary, 'artifacts');
    mkdirSync(stage);
    mkdirSync(artifacts);
    for (const [path, content] of files) {
      const destination = join(stage, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content, { flag: 'wx', mode: path === 'initskill' || path === 'cli.mjs' ? 0o755 : 0o644 });
    }
    const packed = npmPack(stage, artifacts, join(temporary, 'npm-cache'));
    const actual = packed.files?.map((file) => file.path).sort();
    if (packed.filename !== tarball || JSON.stringify(actual) !== JSON.stringify(packageFiles)) {
      throw new Error('npm pack contents differ from the release whitelist; refusing incomplete or unexpected bundle');
    }
    const instructions = `# Install ${pkg.name} ${pkg.version}\n\nTarball: ${tarball}\n\n`
      + files.get('DISTRIBUTION.md').toString().replaceAll('<RELEASE_TARBALL>', tarball).replaceAll('<RELEASE_VERSION>', pkg.version);
    const contents = new Map([[tarball, readFileSync(join(artifacts, tarball))], ['INSTALL.md', Buffer.from(instructions)]]);
    const checksums = [...contents].map(([name, content]) => `${createHash('sha256').update(content).digest('hex')}  ${name}\n`).join('');
    contents.set('SHA256SUMS', Buffer.from(checksums));

    // Exclusive creation also catches an output directory created while npm was running.
    validateOutput(output, source);
    mkdirSync(output);
    ownsOutput = true;
    for (const [name, content] of contents) {
      const destination = join(output, name);
      const fd = openSync(destination, 'wx', 0o644);
      created.push(destination);
      try { writeFileSync(fd, content); } finally { closeSync(fd); }
    }
    return result;
  } catch (error) {
    // Remove only files exclusively created by this invocation, never an existing user directory.
    for (const path of created.reverse()) unlinkSync(path);
    if (ownsOutput) {
      try { rmdirSync(output); } catch { /* Preserve any new external files in the output. */ }
    }
    throw error;
  } finally {
    // This exact directory was allocated by mkdtemp, contains only our staging/cache files.
    rmSync(temporary, { recursive: true, force: true });
  }
}

function main(args) {
  let output;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--dry-run') dryRun = true;
    else if (args[index] === '--output-dir') {
      output = args[++index];
      if (!output?.trim() || output.startsWith('--')) throw new Error('--output-dir requires a specific path');
    } else if (args[index] === '--help') {
      console.log('Usage: node release-bundle.mjs [--output-dir <new-directory>] [--dry-run]');
      return;
    } else throw new Error(`Unknown argument: ${args[index]}`);
  }
  console.log(JSON.stringify(buildReleaseBundle(output, { dryRun }), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Release bundle failed: ${error.message}`); process.exitCode = 1; }
}
