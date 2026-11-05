# Native Subagent Orchestration

Use this workflow for independent implementation slices, bounded investigation, or a separate verification pass. Simple dependent work can remain in the coordinator.

## Dispatch contract

- Read `.agents/project/subagent-contract.md` and inspect the native tools exposed by the current host before dispatching. Codex uses native spawn/message/wait/close tools and project custom agents; Antigravity uses `invoke_subagent` with `subagent: true` role definitions. Follow the live tool schema, not assumed parameters.
- Give each worker the objective, acceptance criteria, relevant raw inputs, allowed write paths or read-only status, baseline user changes, and expected evidence. Antigravity workers start with separate context; explicitly pass what they need.
- Assign disjoint write scopes or host-provided isolated worktrees. Keep edits to shared contracts in the coordinator. Use up to three concurrent workers by default and do not allow recursive spawning without a new scoped budget.
- Select relevant roles: Developer implements; Tester verifies behavior; Reviewer independently audits the final diff; CI/CD checks delivery changes; Git reviews release scope; Skill Author addresses a concrete missing capability.
- Do useful non-overlapping work while workers run. Collect completion statuses and artifacts, then integrate and run checks on the final state.

## Independent verification

- The implementation author must not be its only reviewer. Provide a stable diff and acceptance criteria to a different Reviewer without supplying the conclusions it is supposed to find.
- Treat findings as hypotheses until supported by code, reproductions, or test results. Resolve disagreement from evidence; do not accept a majority vote as correctness.
- Keep the reviewer read-only. Give QA only the permissions required for relevant checks, and report product/test/environment failures separately.
- On a reproduced defect, request a bounded repair and repeat affected checks. Stop after three repair rounds with evidence and unresolved risks instead of weakening checks.
- Close finished workers and cancel obsolete tasks. Report unavailable/blocked review separately from passed tests; never fabricate worker IDs, test results, or independent approval.

## Skill evolution

When a real workflow gap appears, delegate a project-local skill draft to Skill Author, follow the installed skill-authoring contract, then review and validate it before use. Instruction changes do not grant tool permissions, authorize publication, or permit bypassing user constraints.

## Example

Task: Implement an API change and verify regression risk.
Expected: Assign Developer a bounded implementation slice; let QA design cases on a separate write set; after integration, send the stable diff to a separate read-only Reviewer; run checks on the final result and report both test and review evidence.
