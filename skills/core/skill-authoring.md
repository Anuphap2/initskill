# Skill Authoring Standard

## Contract

Create or adapt a project-local `SKILL.md` used by Codex and Antigravity when a task has a concrete capability gap or an existing skill demonstrably misroutes work. Reuse matching skills first; do not create one for every task.

## Anti-Skill-Hell Design Principles

- **Narrow & Unambiguous Triggers (ห้าม Trigger ชนกัน)**: สกิลต้องมีคำอธิบายเงื่อนไขการเรียกใช้ (trigger description) ที่ชัดเจนและเจาะจง ห้ามสร้างสกิลที่มีขอบเขตทับซ้อนกัน เพราะจะทำให้ Agent สับสน เกิด attention drift หรือต้องโหลดหลายสกิลพร้อมกันจนบริบทบวม (Context Bloat)
- **Progressive Disclosure**: เก็บเฉพาะสาระสำคัญ ลำดับขั้นตอน และ decision points ไว้ใน `SKILL.md` หากมีข้อมูลอ้างอิง โค้ดตัวอย่างขนาดใหญ่ หรือ helper scripts ให้แยกเก็บในโฟลเดอร์ย่อย (`resources/`, `scripts/`) เพื่อประหยัด context window
- **Skill Pruning & Efficiency**: มีสกิลเท่าที่จำเป็นจริงๆ ตัดหรือรวมสกิลที่ซ้ำซ้อนหรือไม่ได้ใช้งานออก เพื่อให้ Agent loop ทำงานได้เร็วที่สุด (Fast TPS & Low Latency)

## Big Agent teaches Small Agent Pattern

- **Senior/Architect Mentorship**: ใช้ Agent/Model ขนาดใหญ่ที่มีความสามารถสูง ออกแบบ Spec, Acceptance Criteria และสร้าง Skill/Guideline ที่ตกผลึกแล้ว
- **Worker Execution**: ส่งต่อ Skill และ Spec ให้กับ Small/Fast Agent (Low Effort, Fast TPS) นำไปปฏิบัติตามอย่างแม่นยำและประหยัด token
- **Retrospective Loop**: เมื่อ Worker ทำงานผิดพลาด ให้อัปเดต Skill เพื่อสอนและป้องกันไม่ให้เกิดความผิดพลาดซ้ำเดิม

## Required structure

- Add YAML frontmatter with a unique lowercase `name` and a specific `description` that explains what the skill does and when to use it.
- Define the skill's responsibility and trigger conditions before implementation details.
- State required inputs, constraints, prohibited actions, and permission boundaries.
- Write a procedure with useful decision points and verification steps; avoid prescribing unnecessary ceremony for simple work.
- Define the output format. Use a schema when downstream automation consumes the result.
- Add a small input/expected-output example that demonstrates the intended behavior.

## Production quality

- Keep one skill focused on one capability; split unrelated responsibilities into separate skills.
- Treat tool calls as contracts: document preconditions, parameters, side effects, failure handling, and safe retries.
- Include a verification loop and fail-safe behavior. The skill must report uncertainty instead of inventing data.
- Consider state, memory, complexity, security, scalability, observability, compatibility, and technical debt before finalizing the design.

## Safe creation and adaptation

1. Identify the gap and one realistic task that would benefit. Read any existing related skill, repository contracts, and its supporting resources.
2. Scope instruction changes to `.agents/skills/<name>/SKILL.md` and task-relevant resources. Do not change global skills, permissions, project safety policy, credentials, or unrelated instructions.
3. Draft a complete skill file in an authorized scratch location, with a name matching the destination folder and a precise trigger description. Do not include secrets or copied chat history.
4. Use `initskill skill create <name> --from-file <draft> --json --dry-run`, then create it after reviewing the plan. For adaptation, use `initskill skill inspect <name> --json` to obtain the current hash, then `initskill skill update <name> --from-file <draft> --expected-hash <hash> --json`. The expected hash must reflect the version actually reviewed; a changed file requires re-reading and revising, not a blind retry.
5. Run `initskill skill validate --json`. Validate any new executable helpers before running them on real data. Preserve unrelated metadata and resources; a backup is not permission to overwrite arbitrary user instructions.
6. Have another available native reviewer exercise a realistic task in an isolated workspace and inspect the resulting evidence. If delegation is unavailable, report that behavioral review is incomplete. Metadata validation alone does not prove decision quality.
7. Adopt only the reviewed narrow improvement; report purpose, changed paths, backup, validation, behavior evidence, and limitations. Keep external publication separate from local creation.

## Example

Task: A repository uses a custom test command that the current QA skill misses.
Expected: Verify that command from package scripts or CI, adapt the project-local QA guidance with a narrow trigger, preserve existing checks, validate the file, and independently exercise the command-selection behavior without weakening tests.

## Language

- Write system instructions, metadata, triggers, constraints, and procedures in precise English when this reduces ambiguity.
- Preserve code identifiers, API names, commands, schemas, and error messages exactly.
- Specify the user-facing response language separately, for example: `Respond in natural Thai when the user communicates in Thai.`

## Safe creation and adaptation

1. Identify the gap and one realistic task that would benefit. Read any existing related skill, repository contracts, and its supporting resources.
2. Scope instruction changes to `.agents/skills/<name>/SKILL.md` and task-relevant resources. Do not change global skills, permissions, project safety policy, credentials, or unrelated instructions.
3. Draft a complete skill file in an authorized scratch location, with a name matching the destination folder and a precise trigger description. Do not include secrets or copied chat history.
4. Use `initskill skill create <name> --from-file <draft> --json --dry-run`, then create it after reviewing the plan. For adaptation, use `initskill skill inspect <name> --json` to obtain the current hash, then `initskill skill update <name> --from-file <draft> --expected-hash <hash> --json`. The expected hash must reflect the version actually reviewed; a changed file requires re-reading and revising, not a blind retry.
5. Run `initskill skill validate --json`. Validate any new executable helpers before running them on real data. Preserve unrelated metadata and resources; a backup is not permission to overwrite arbitrary user instructions.
6. Have another available native reviewer exercise a realistic task in an isolated workspace and inspect the resulting evidence. If delegation is unavailable, report that behavioral review is incomplete. Metadata validation alone does not prove decision quality.
7. Adopt only the reviewed narrow improvement; report purpose, changed paths, backup, validation, behavior evidence, and limitations. Keep external publication separate from local creation.

## Example

Task: A repository uses a custom test command that the current QA skill misses.
Expected: Verify that command from package scripts or CI, adapt the project-local QA guidance with a narrow trigger, preserve existing checks, validate the file, and independently exercise the command-selection behavior without weakening tests.

## Language

- Write system instructions, metadata, triggers, constraints, and procedures in precise English when this reduces ambiguity.
- Preserve code identifiers, API names, commands, schemas, and error messages exactly.
- Specify the user-facing response language separately, for example: `Respond in natural Thai when the user communicates in Thai.`
