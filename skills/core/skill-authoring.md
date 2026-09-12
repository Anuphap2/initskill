# Skill Authoring Standard

## Contract

Use this guidance when creating or reviewing an Antigravity `SKILL.md`.

## Required structure

- Add YAML frontmatter with a unique lowercase `name` and a specific `description` that explains what the skill does and when to use it.
- Define the skill's responsibility and trigger conditions before implementation details.
- State required inputs, constraints, prohibited actions, and permission boundaries.
- Write a deterministic, numbered procedure with explicit decision points and verification steps.
- Define the output format. Use a schema when downstream automation consumes the result.
- Add a small input/expected-output example that demonstrates the intended behavior.

## Production quality

- Keep one skill focused on one capability; split unrelated responsibilities into separate skills.
- Prefer progressive disclosure: keep `SKILL.md` concise and place large references, examples, or scripts in the skill folder when needed.
- Treat tool calls as contracts: document preconditions, parameters, side effects, failure handling, and safe retries.
- Include a verification loop and fail-safe behavior. The skill must report uncertainty instead of inventing data.
- Consider state, memory, complexity, security, scalability, observability, compatibility, and technical debt before finalizing the design.

## Language

- Write system instructions, metadata, triggers, constraints, and procedures in precise English when this reduces ambiguity.
- Preserve code identifiers, API names, commands, schemas, and error messages exactly.
- Specify the user-facing response language separately, for example: `Respond in natural Thai when the user communicates in Thai.`
