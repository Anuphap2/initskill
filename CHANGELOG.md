# Changelog

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
