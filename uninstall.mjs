#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { sha256 } from './file-safety.mjs';

function parseArgs(args) {
  const options = { prefix: join(homedir(), '.agent-skills'), yes: false, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--prefix') options.prefix = args[++i];
    else if (args[i] === '--yes') options.yes = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else throw new Error(`ไม่รู้จัก option: ${args[i]}`);
  }
  if (!options.prefix) throw new Error('--prefix ต้องระบุ path');
  return options;
}

function ensureSafePrefix(prefix) {
  const target = resolve(prefix);
  const home = resolve(homedir());
  const sameHome = process.platform === 'win32' ? target.toLowerCase() === home.toLowerCase() : target === home;
  if (target === resolve(target, '..') || sameHome) {
    throw new Error('ปฏิเสธการถอนการติดตั้ง: prefix ต้องเป็นโฟลเดอร์เฉพาะ ไม่ใช่ filesystem root หรือ Home Directory');
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('ปฏิเสธการถอนการติดตั้ง: install directory เป็น symbolic link');
  return target;
}

function pruneEmptyParents(target, path) {
  let current = resolve(path, '..');
  while (current.startsWith(`${target}${sep}`) && current !== target) {
    try { rmdirSync(current); } catch { break; }
    current = resolve(current, '..');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = ensureSafePrefix(options.prefix);
  const manifestPath = join(target, '.install-manifest.json');
  if (!existsSync(manifestPath)) throw new Error('ไม่พบ install manifest; รัน install.mjs ก่อนเพื่อบันทึกไฟล์ที่เครื่องมือนี้เป็นเจ้าของ');
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { throw new Error('install manifest อ่านไม่ได้; หยุดเพื่อไม่ลบไฟล์โดยเดา'); }
  if (manifest?.schemaVersion !== 1 || manifest.packageName !== 'local-agent-skill-manager' || typeof manifest.files !== 'object') {
    throw new Error('install manifest ไม่ตรงกับเครื่องมือนี้; หยุดเพื่อความปลอดภัย');
  }

  const remove = [];
  const preserve = [];
  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const path = resolve(target, relativePath);
    if (path !== target && !path.startsWith(`${target}${sep}`)) throw new Error(`manifest มี path นอก install directory: ${relativePath}`);
    if (!existsSync(path)) continue;
    if (lstatSync(path).isSymbolicLink()) { preserve.push(relativePath); continue; }
    if (lstatSync(path).isFile() && sha256(readFileSync(path, 'utf8')) === expectedHash) remove.push({ relativePath, path });
    else preserve.push(relativePath);
  }
  const nodeModules = join(target, 'node_modules');
  const hasNodeModules = existsSync(nodeModules);

  console.log(`จะถอนการติดตั้งจาก: ${target}`);
  for (const item of remove) console.log(`ลบไฟล์ที่ไม่ถูกแก้ไข: ${item.relativePath}`);
  for (const path of preserve) console.log(`เก็บไฟล์ที่ผู้ใช้แก้ไขไว้: ${path}`);
  if (hasNodeModules) console.log('ลบ dependencies ภายใน node_modules ของเครื่องมือนี้');
  if (options.dryRun) { console.log('Dry run: ไม่มีการลบไฟล์'); return; }

  if (!options.yes) {
    if (!stdin.isTTY || !stdout.isTTY) throw new Error('ต้องยืนยันแบบ interactive หรือระบุ --yes เพื่อถอนการติดตั้งแบบอัตโนมัติ');
    const readline = createInterface({ input: stdin, output: stdout });
    const answer = await readline.question('ยืนยันหรือไม่? พิมพ์ yes: ');
    readline.close();
    if (answer.toLowerCase() !== 'yes') { process.exitCode = 130; console.log('ยกเลิกแล้ว'); return; }
  }

  for (const item of remove) {
    rmSync(item.path, { force: true });
    pruneEmptyParents(target, item.path);
  }
  if (hasNodeModules) rmSync(nodeModules, { recursive: true, force: true });
  rmSync(manifestPath, { force: true });
  try { rmdirSync(target); } catch { /* Preserve custom skills, backups, and other user data. */ }
  console.log('ถอนการติดตั้งเสร็จแล้ว; ไฟล์ที่แก้ไขและไฟล์ส่วนตัวถูกเก็บไว้');
}

main().catch((error) => {
  console.error(`ถอนการติดตั้งไม่สำเร็จ: ${error.message}`);
  process.exitCode = error.message.includes('--yes') ? 2 : 1;
});
