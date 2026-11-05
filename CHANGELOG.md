# Changelog

## 1.3.0 — 2026-10-06

- Registered project-scoped Codex native custom agents and explicitly dispatchable Antigravity subagents, with an independent read-only Reviewer.
- Added bounded delegation, disjoint write scopes, final-state verification, worker cleanup, and honest blocked-review reporting in the shared contract.
- Added safe project-local `skill create`, `inspect`, `list`, `update`, and `validate` commands; adaptations require an optimistic-concurrency hash and durable backup.
- Added task-specific skill-authoring and orchestration guidance, selected automatically with the general profile.
- Added local release bundles with a file whitelist, SHA-256 checksums, and AI installation instructions for public/private repositories; no automatic remote publication.

## 1.2.0 — 2026-10-06

- Added interactive and non-interactive target selection for Codex, Antigravity, or both; auto respects saved preferences and detects known host signals without depending on the terminal UI.
- Generated shared, discoverable `.agents/skills/<name>/SKILL.md` files in both modes, with task-specific trigger descriptions and a scoped selection catalogue in `AGENTS.md`.
- Kept Antigravity custom agents separate from Codex's instruction/skill workflow; reduced workspace rules to a compact routing instruction.
- Added `list --json`, explicit `--rules` selection, and JSON initialization results for AI-driven setup without menus.
- Made doctor target-aware and detect missing selected skills; preserved user-authored instructions and refused conflicts as before.
- Added regression coverage for all six target/mode combinations, host selection, AI discovery, dry runs, and safe updates (35 tests).

## 1.1.2 — 2026-09-26

- Made plain `initskill` usable from Codex and CI processes without an interactive TTY by selecting the recommended Agent profile safely.

## 1.1.1 — 2026-09-26

- Fixed Antigravity workspace rules by generating valid YAML frontmatter and validating `trigger` values in `doctor`.
- Kept generated workspace rules below Antigravity's per-file limit for the standard general profile.

## 1.1.0 — 2026-09-12

- Added conflict previews, safe update tracking, explicit keep/overwrite choices, durable backups, and atomic writes.
- Made `doctor` detect Agent, Skill, or both modes without requiring unrelated output files.
- Added deterministic CLI help/version, dry-run, and non-interactive init commands.
- Added configurable Git commit policies (`ask`, `auto`, `off`) stored per project.
- Added Node-based cross-platform install/update and safe uninstall flows; user-added skills are preserved.
- Added cross-platform tests and GitHub Actions CI/release artifact workflow.
