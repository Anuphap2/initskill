# Local Agent Skill Manager CLI

เครื่องมือจัดการ Agent, Skills และ project rules สำหรับ **Codex และ Google Antigravity** โดยสร้างไฟล์ลงใน workspace ที่ระบุ ไม่แก้ business code ของโปรเจกต์ ไม่ต้องติดตั้ง Cursor หรือสร้าง `.cursorrules`

## Requirements

- Node.js 20 ขึ้นไป
- Windows, macOS หรือ Linux

## เริ่มใช้เร็ว

เปิด Terminal ที่โฟลเดอร์โปรเจกต์ แล้วเรียก:

```text
initskill
```

เลือกปลายทาง `ใช้ร่วมกัน` (แนะนำ), `Codex` หรือ `Antigravity` แล้วเลือก `เริ่มงานทั่วไป` ไม่จำเป็นต้องเลือกทุก Skill เอง: AI จะใช้คำอธิบายและ catalogue เพื่อเลือกเฉพาะที่เหมาะกับงาน

ถ้าไม่มี interactive terminal คำสั่งเปล่าจะเลือก Agent ชุดทั่วไปและปลายทาง `auto` โดยไม่ถามเมนู หากต้องการให้ทั้งสองตัวใช้โปรเจกต์เดียวกันได้แน่นอน:

```text
initskill init --target both --non-interactive
initskill doctor
```

ระบบไม่เขียนทับไฟล์ที่แก้เองโดยไม่ได้รับอนุญาต ความสามารถนี้ไม่ใช่การซ่อมระบบเริ่มโปรเซสของ IDE: ถ้า AI เริ่ม shell ไม่ได้ ต้องแก้ปัญหา runtime ของแอป หรือให้ผู้ใช้รันคำสั่งตั้งค่าเองก่อน

ก่อนเขียน CLI จะแสดงไฟล์ที่จะสร้าง/อัปเดตพร้อม diff หากพบไฟล์ที่ยังไม่รู้จักหรือมีการแก้ไขเอง จะให้เลือกอัปเดตโดยสำรองไฟล์เดิม เก็บไฟล์เดิม หรือยกเลิกทั้งหมด ไฟล์สำรองอยู่ใน `.agent-skills-backups/` และ metadata สำหรับติดตามไฟล์ที่ CLI สร้างอยู่ใน `.agent-skill-manager.json`

## คำสั่ง

```text
initskill --help
initskill --version
initskill doctor
initskill doctor --mode skill
initskill doctor --mode agent --json
initskill doctor --target codex --json
initskill list --json
initskill config git-policy
initskill config git-policy auto
```

สร้างแบบไม่ใช้เมนู เหมาะกับ CI:

```text
initskill init --target codex --non-interactive --dry-run
initskill init --target antigravity --non-interactive
initskill init --target both --mode agent --profile general --non-interactive --on-conflict error
```

ค่าเริ่มต้นเมื่อไม่ใช้เมนูคือ `--mode agent --profile general --target auto` และนโยบายไฟล์ชนกันเป็น `error` เพื่อไม่ให้ CI ข้ามหรือเขียนทับไฟล์อย่างเงียบ ๆ ตัวเลือก `--on-conflict` มี `keep`, `overwrite` และ `error`; การเขียนทับจะเก็บไฟล์เดิมไว้ในโฟลเดอร์สำรองก่อน

ตัวเลือกหลัก:

- `--mode agent|skill` เลือกรูปแบบผลลัพธ์
- `--target auto|codex|antigravity|both` เลือก AI ที่จะใช้
- `--profile general|developer|tester|delivery` เลือกชุดกฎ
- `--rules <id,id,...>` เลือก Skill ตาม id หรือ name จาก `list --json` (ใช้แทน `--profile`)
- `--json` แสดงผลสำหรับโปรแกรม; ใน `init` จะไม่ถามเมนู
- `--skills-dir <path>` ระบุคลัง Markdown rules
- `--output-dir <path>` ระบุ project root
- `--dry-run` แสดงแผนโดยไม่เขียนไฟล์
- `--commit-policy ask|auto|off` กำหนดนโยบาย Git ในไฟล์ตั้งค่าโปรเจกต์

`doctor --mode` เลือกตรวจ `auto`, `agent`, `skill` หรือ `both` ได้ โดย `auto` ใช้โหมดที่บันทึกใน config หรือ manifest/ไฟล์ที่มีจริง และตรวจตามปลายทางที่บันทึกไว้ เช่น Codex ไม่จำเป็นต้องมี Antigravity custom agents

`--target auto` ใช้ตามลำดับ: ค่า target ที่บันทึกในโปรเจกต์ → สัญญาณ host ที่รู้จัก (`CODEX_THREAD_ID` หรือ `TERM_PROGRAM` ที่ระบุ Antigravity) → โฟลเดอร์ `.codex`/`.agents/agents`/`.agents/rules` → `both` หากไม่สามารถแยกได้ การระบุ `--target` โดยตรงมีลำดับความสำคัญสูงสุด การตรวจ host เป็น heuristic ไม่ใช่การรับประกันว่า IDE ทุกเวอร์ชันจะส่งสัญญาณมา

## ให้ AI เลือกเอง

หลังตั้งค่าแล้ว ทั้งสองตัวพบ Skills จาก `.agents/skills/` และเลือกจากคำอธิบาย trigger ตามงาน เช่น แก้โค้ดใช้ Developer, ตรวจ regression ใช้ QA, แก้ pipeline ใช้ CI/CD และทำ commit ใช้ Git โดยอ่าน `SKILL.md` ที่เลือกก่อนทำงาน ไม่ต้องโหลดทุกไฟล์ลง context

หากต้องการให้ AI เลือกชุดตั้งค่าเองโดยไม่ใช้เมนู:

```text
initskill list --json
initskill init --target codex --mode skill --rules developer-implementation,tester-qa-strategy --json --dry-run
initskill init --target codex --mode skill --rules developer-implementation,tester-qa-strategy --json
initskill doctor --json
```

AI อ่านรายการ `skills`/`profiles` แล้วเลือก `id` หรือ `name` ที่ตรงงาน ผล JSON ของ `init` ระบุ target, mode, รายการไฟล์และ action; ข้อผิดพลาดให้ `ok: false` และ exit code ที่ไม่ใช่ศูนย์ การเลือกเป็นพฤติกรรมของโมเดล ไม่ใช่การรับประกันว่าจะเลือกถูกทุกครั้ง ผู้ใช้ระบุชื่อ Skill โดยตรงได้

## นโยบาย Git

นโยบายถูกเก็บใน `.agents/project/agent-manager-config.json`:

- `ask` — เสนอ local checkpoint commit แล้วรอผู้ใช้ยืนยัน (ค่าเริ่มต้น)
- `auto` — อนุญาต local commit หลังตรวจ diff, tests และ staged files ผ่าน guardrails; ห้าม stage `-A`, push หรือ merge อัตโนมัติ
- `off` — ห้าม Agent สร้าง commit

เปลี่ยนนโยบายภายหลังด้วย `initskill config git-policy ask|auto|off` ระบบจะสำรอง config เดิมก่อนแก้ไข

## โครงสร้างที่สร้าง

ทุกปลายทางและทุกโหมดสร้าง `AGENTS.md`, `.agents/skills/<name>/SKILL.md` และไฟล์ project context/architecture/debt/config โดยไม่แก้ business code

- **Codex:** โหมด Agent เพิ่ม native custom subagents ที่ `.codex/agents/skill-manager-<role>.toml` พร้อม `name`, `description`, `developer_instructions`; Reviewer ใช้ sandbox แบบ read-only และไม่บังคับ model ของผู้ใช้ CLI/IDE เรียก Skill ด้วย `/skills` หรือ `$skill-name`
- **Antigravity:** โหมด Agent เพิ่ม `.agents/agents/<name>/agent.md`; roles มี `subagent: true`, `mainAgent: false` และจำกัด tools ตามหน้าที่ ส่วน Engineering Team เป็น coordinator หลัก; โหมด Skill ไม่สร้าง custom agents
- **Both:** รวมชุดไฟล์ข้างต้นเพื่อใช้โปรเจกต์เดียวกัน การเปลี่ยน target ไม่ลบไฟล์ของ target เดิมหรือไฟล์ผู้ใช้

ไฟล์ลงทะเบียนพร้อมใช้กับ host ที่รองรับ แต่ CLI นี้ไม่ได้เปิดหลาย AI processes เอง: AI หลักใช้เครื่องมือ native ของแอปเพื่อเรียก role ที่เหมาะสม เมื่อไม่มีเครื่องมือหรือสิทธิ์ ต้องแจ้งว่าไม่ได้ตรวจอิสระ ไม่แสร้งว่าทำเองแล้วผ่านจากอีก AI

## เรียกทีมมาทำงานและตรวจทาน

ตั้งค่า `--mode agent --target both` แล้วเริ่ม session ใหม่ใน project root สามารถบอก AI ว่า “แบ่งงานที่ทำคู่ขนานได้ให้ subagent และให้ Reviewer คนละตัวตรวจ diff หลังรวมงาน พร้อม QA รันเทสต์” ได้ทันที

คำสั่ง dispatch ขึ้นกับแอป: Codex ใช้ native spawn/message/wait/close tools ที่ session มี; Antigravity ใช้ `invoke_subagent` ตาม schema จริง ไม่ใช้ชื่อ role เป็นคำสั่ง shell

Roles ชุดทั่วไปคือ Developer, Tester, Reviewer, CI/CD, Git/Release และ Skill Author โดยโปรไฟล์เฉพาะงานไม่สร้าง role ที่ไม่เกี่ยวข้อง สัญญาการส่งงานอยู่ที่ `.agents/project/subagent-contract.md`:

- แยกขอบเขตไฟล์ก่อนส่งงาน ใช้ write set ที่ไม่ทับกันหรือ worktree ที่แอปรองรับ
- ค่าเริ่มต้นไม่เกิน 3 workers พร้อมกัน ไม่แตก subagents ซ้อนโดยไม่มีงบ/ขอบเขตใหม่
- Reviewer คนละตัวกับผู้เขียนตรวจ diff สุดท้าย โดยไม่แก้ patch ที่กำลังตรวจ
- QA ตรวจผลหลังรวมงาน และแยก failure ของโค้ด เทสต์ และ environment
- ซ่อมแบบจำกัดสูงสุด 3 รอบ แล้วรายงานหากยังไม่ผ่าน ปิด workers เมื่อหมดงาน
- Workers ไม่ commit/publish/deploy เอง สิทธิ์เหล่านี้ยังอยู่ภายใต้ผู้ใช้และ coordinator

อิง [Codex Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) และ [Antigravity Custom Subagents](https://www.antigravity.google/docs/subagents/) แอปรุ่นเก่า หรือ session ที่ปิด delegation อาจเรียกไม่ได้ `doctor` ตรวจโครงสร้างไฟล์ ไม่ยืนยันบัญชี โควตา สิทธิ์ runtime หรือคุณภาพการทำงานของโมเดล

## AI สร้างหรือปรับ Skill ตามงาน

เริ่มจากอ่าน Skill เดิม หากยังขาดความสามารถที่จำเป็น ให้เขียนไฟล์ฉบับเต็มในพื้นที่ร่างที่ได้รับอนุญาต แล้วใช้:

```text
initskill skill create api-contract --from-file draft/SKILL.md --json --dry-run
initskill skill create api-contract --from-file draft/SKILL.md --json
initskill skill inspect api-contract --json
initskill skill validate --json
```

หากต้องการปรับของเดิม ให้ใช้ค่า `hash` จาก `inspect` ของเวอร์ชันที่อ่านจริง:

```text
initskill skill update api-contract --from-file draft/SKILL.md --expected-hash <hash-from-inspect> --json --dry-run
initskill skill update api-contract --from-file draft/SKILL.md --expected-hash <hash-from-inspect> --json
```

การเขียนจำกัดที่ `.agents/skills/<name>/SKILL.md`; update ต้องมี hash ตรงก่อนเขียนและสำรองไฟล์เดิม ไม่แก้ resources ที่มีอยู่ การสร้างชื่อซ้ำไม่เขียนทับให้เอง ทักษะที่ AI ปรับจะถูกมองเป็น custom change และ `init` ครั้งต่อไปจะไม่ทับแบบเงียบ ๆ

ผู้ใช้เริ่มจากโครงร่างได้ด้วย `initskill skill create <name> --description "Specific task trigger"`; ผลลัพธ์เป็น **draft** ต้องเพิ่มขั้นตอนเฉพาะงานและทดลองก่อนใช้ `list`/`inspect`/`validate` อ่านเฉพาะไฟล์ ไม่ execute scripts ของ Skill

Validator รองรับ frontmatter แบบ flat plain/quoted strings สำหรับ name/description และ scalar metadata อื่น ๆ; YAML ที่ซับซ้อนกว่านี้จะหยุดพร้อมแจ้งข้อจำกัด ไม่แปลงหรือลบ metadata ให้เอง การผ่าน validator เป็นเพียงการตรวจรูปแบบ ต้องมี Reviewer ทดลองพฤติกรรมใน workspace แยกก่อนรับเป็นทักษะใช้งานจริง ไม่สร้าง/แก้ global skills หรือลด guardrails เพื่อให้งานผ่าน

ถ้า Antigravity ไม่เห็น Agent ให้ปิดแล้วเปิด workspace/session ใหม่ จากนั้นพิมพ์ `/agents` อีกครั้ง ไฟล์ Agent ต้องอยู่ที่ `.agents/agents/<name>/agent.md` และไฟล์ใน `.agents/rules/` ต้องมี `trigger` ที่ถูกต้อง มิฉะนั้น Antigravity จะไม่โหลด rule แบบเงียบ ๆ

เพิ่ม rule ได้โดยวาง Markdown ไว้ใต้ `skills/<category>/` ในคลังของ CLI แล้วเรียก `initskill` อีกครั้ง ไม่ต้องแก้ source code ของ CLI

รูปแบบอ้างอิงจากเอกสารทางการ: [Codex Skills](https://learn.chatgpt.com/docs/build-skills), [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Antigravity Skills](https://www.antigravity.google/docs/skills?tab=ide), [Antigravity Rules](https://www.antigravity.google/docs/rules/), [Antigravity custom agents](https://www.antigravity.google/docs/cli/commands/agents/)

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

สร้างแพ็กเกจพร้อม checksum และคู่มือติดตั้งสำหรับ AI ได้ด้วย `npm run release:bundle` (ค่าเริ่มต้น `dist/`; ต้องเป็นโฟลเดอร์ใหม่) ไม่ commit หรือเผยแพร่ให้อัตโนมัติ รายละเอียด public/private และการติดตั้งแบบระบุเวอร์ชันอยู่ใน [DISTRIBUTION.md](DISTRIBUTION.md)

ขั้นตอน release คือ bump version (`npm version patch|minor|major --no-git-tag-version`), อัปเดต `CHANGELOG.md`, รัน `npm shrinkwrap` และ `npm run verify`, ตรวจขอบเขต/ความลับก่อน commit แล้ว push commit และ tag `v<version>` เมื่อผู้ใช้อนุมัติ CI จะสร้าง tarball, SHA256SUMS และ INSTALL.md ให้ GitHub Release ไม่ publish npm และยังต้องเลือก repository/visibility/license ก่อนเผยแพร่จริง
