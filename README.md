# Local Agent Skill Manager CLI

เครื่องมือจัดการ Agent, Skills และ project rules สำหรับ Google Antigravity โดยสร้างไฟล์ลงใน workspace ที่ระบุ ไม่แก้ business code ของโปรเจกต์

## Requirements

- Node.js 20 ขึ้นไป
- Windows, macOS หรือ Linux

## เริ่มใช้เร็ว

เปิด Terminal ที่โฟลเดอร์โปรเจกต์ แล้วเรียก:

```text
initskill
```

เลือก `เริ่มงานทั่วไป` เพื่อสร้าง Engineering Team Agent หรือเลือก `สร้าง Skill ทั่วไป` หากต้องการ Skills แยกเป็นรายการ

ถ้าเรียกจาก Codex, CI หรือโปรเซสที่ไม่มี interactive terminal คำสั่งเปล่าจะเลือก Agent ชุดทั่วไปให้อัตโนมัติและไม่เขียนทับไฟล์ที่มีอยู่ หากต้องการระบุชัดเจน ใช้ `initskill init --mode agent --profile general --non-interactive` หรือ `initskill init --mode skill --profile general --non-interactive`

ก่อนเขียน CLI จะแสดงไฟล์ที่จะสร้าง/อัปเดตพร้อม diff หากพบไฟล์ที่ยังไม่รู้จักหรือมีการแก้ไขเอง จะให้เลือกอัปเดตโดยสำรองไฟล์เดิม เก็บไฟล์เดิม หรือยกเลิกทั้งหมด ไฟล์สำรองอยู่ใน `.agent-skills-backups/` และ metadata สำหรับติดตามไฟล์ที่ CLI สร้างอยู่ใน `.agent-skill-manager.json`

## คำสั่ง

```text
initskill --help
initskill --version
initskill doctor
initskill doctor --mode skill
initskill doctor --mode agent --json
initskill config git-policy
initskill config git-policy auto
```

สร้างแบบไม่ใช้เมนู เหมาะกับ CI:

```text
initskill init --mode agent --profile general --non-interactive --dry-run
initskill init --mode agent --profile general --non-interactive --on-conflict error
```

`--non-interactive` ต้องระบุ `--mode`; profile เริ่มต้นคือ `general` และนโยบายไฟล์ชนกันเริ่มต้นเป็น `error` เพื่อไม่ให้ CI ข้ามหรือเขียนทับไฟล์อย่างเงียบ ๆ ตัวเลือก `--on-conflict` มี `keep`, `overwrite` และ `error`; การเขียนทับจะเก็บไฟล์เดิมไว้ในโฟลเดอร์สำรองก่อน

ตัวเลือกหลัก:

- `--mode agent|skill` เลือกรูปแบบผลลัพธ์
- `--profile general|developer|tester|delivery` เลือกชุดกฎ
- `--skills-dir <path>` ระบุคลัง Markdown rules
- `--output-dir <path>` ระบุ project root
- `--dry-run` แสดงแผนโดยไม่เขียนไฟล์
- `--commit-policy ask|auto|off` กำหนดนโยบาย Git ในไฟล์ตั้งค่าโปรเจกต์

`doctor` เลือกตรวจ `auto`, `agent`, `skill` หรือ `both` ได้ โดย `auto` ใช้ manifest และไฟล์ที่มีจริง ไม่บังคับว่าทุกโปรเจกต์ต้องมีทั้ง Agent และ Skill

## นโยบาย Git

นโยบายถูกเก็บใน `.agents/project/agent-manager-config.json`:

- `ask` — เสนอ local checkpoint commit แล้วรอผู้ใช้ยืนยัน (ค่าเริ่มต้น)
- `auto` — อนุญาต local commit หลังตรวจ diff, tests และ staged files ผ่าน guardrails; ห้าม stage `-A`, push หรือ merge อัตโนมัติ
- `off` — ห้าม Agent สร้าง commit

เปลี่ยนนโยบายภายหลังด้วย `initskill config git-policy ask|auto|off` ระบบจะสำรอง config เดิมก่อนแก้ไข

## โครงสร้างที่สร้าง

โหมด Agent สร้าง `.agents/agents/engineering-team/agent.md`, workspace rule ที่มี YAML frontmatter ตามรูปแบบ Antigravity, project context, architecture/debt templates และ portable `AGENTS.md` ส่วนโหมด Skill สร้างแต่ละ `SKILL.md` พร้อมไฟล์ project พื้นฐาน

ถ้า Antigravity ไม่เห็น Agent ให้ปิดแล้วเปิด workspace/session ใหม่ จากนั้นพิมพ์ `/agents` อีกครั้ง ไฟล์ Agent ต้องอยู่ที่ `.agents/agents/<name>/agent.md` และไฟล์ใน `.agents/rules/` ต้องมี `trigger` ที่ถูกต้อง มิฉะนั้น Antigravity จะไม่โหลด rule แบบเงียบ ๆ

เพิ่ม rule ได้โดยวาง Markdown ไว้ใต้ `skills/<category>/` ในคลังของ CLI แล้วเรียก `initskill` อีกครั้ง ไม่ต้องแก้ source code ของ CLI

## ติดตั้ง อัปเดต และถอนการติดตั้ง

### Windows

จากโฟลเดอร์ที่มี source:

```powershell
.\install.ps1
```

อัปเดตด้วยคำสั่งเดิม ไฟล์ rule ที่แก้เองจะถูกเก็บไว้และแจ้งเตือน หากต้องการแทนที่ไฟล์ที่แก้ ให้ใช้ `.\install.ps1 -Force`; ก่อนแทนที่ระบบสำรองเวอร์ชันเดิมไว้

ถอนการติดตั้งแบบมีการยืนยัน:

```powershell
.\uninstall.ps1
```

หากใช้ตัวติดตั้งจากโฟลเดอร์ที่ติดตั้งไว้แล้ว เรียก `& "$HOME\.agent-skills\uninstall.ps1"`

ใช้ `-DryRun` เพื่อดูแผน และ `-Yes` สำหรับ automation ผู้ใช้เพิ่มหรือแก้ไฟล์เองจะไม่ถูกลบ

### macOS / Linux

```sh
sh ./install.sh
```

สคริปต์ติดตั้งไว้ที่ `~/.agent-skills` และสร้างคำสั่งลัดใน `~/.local/bin` หากโฟลเดอร์นี้ยังไม่อยู่ใน `PATH` สคริปต์จะแสดงบรรทัดที่ต้องเพิ่มใน shell profile อัปเดตด้วยการรัน `sh ./install.sh` ซ้ำ; ใช้ `sh ./install.sh --force` เพื่อแทนที่ไฟล์ที่แก้เองหลังสำรองแล้ว

ถอนการติดตั้ง:

```sh
sh ~/.agent-skills/uninstall.sh
```

หรือใช้ `sh ./uninstall.sh` จาก source checkout

สคริปต์จะถามยืนยันก่อนลบ ใช้ `--dry-run` หรือ `--yes` ได้ตามความเหมาะสม

ตัวติดตั้งไม่คัดลอก `node_modules` จาก source และจะไม่ลบ custom skills หรือไฟล์ที่มีการแก้ไขเองระหว่างอัปเดต/ถอนการติดตั้ง

## พัฒนาและปล่อยเวอร์ชัน

```sh
npm ci
npm run verify
```

GitHub Actions ทดสอบ Node.js 20 และ 22 บน Windows, macOS และ Linux เมื่อ push tag `v<version>` ที่ตรงกับ `package.json` จะสร้าง GitHub Release พร้อม npm tarball สำหรับติดตั้ง/แจกจ่ายภายใน แพ็กเกจยังตั้ง `private: true` เพื่อป้องกันการ publish ขึ้น npm โดยไม่ตั้งใจ

ขั้นตอน release คือ bump version (`npm version patch|minor|major --no-git-tag-version`), อัปเดต `CHANGELOG.md`, รัน `npm shrinkwrap` และ `npm run verify`, จากนั้น push commit และ tag `v<version>` ไปยัง GitHub
