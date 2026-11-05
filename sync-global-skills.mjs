#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverRules, buildGeneratedFiles } from './cli.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetSkillsDir = join(homedir(), '.gemini', 'config', 'skills');

if (!existsSync(targetSkillsDir)) {
  mkdirSync(targetSkillsDir, { recursive: true });
}

// 1. Export all domain/system skills from rules
const rules = discoverRules(join(__dirname, 'skills'));
const files = buildGeneratedFiles(rules, process.cwd(), 'skill');
const skillFiles = files.filter((f) => f.relativePath.startsWith('.agents') && f.relativePath.includes('skills'));

console.log(`Discovered ${rules.length} rules, compiling ${skillFiles.length} skills...`);

for (const file of skillFiles) {
  const parts = file.relativePath.split(/[\\/]/);
  const skillName = parts[parts.indexOf('skills') + 1];
  const skillDir = join(targetSkillsDir, skillName);

  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true });
  }

  const destPath = join(skillDir, 'SKILL.md');
  writeFileSync(destPath, file.content, 'utf8');
  console.log(`[OK] Exported skill: ${skillName}`);
}

// 2. Export initskill CLI skill for AI assistance
const initskillSkill = `---
name: initskill
description: "Initialize, inspect, validate, and manage local agent skills, rules, and configurations for AI coding assistants (Codex and Antigravity) using the initskill CLI."
---

# Initskill CLI - Local Agent Skill Manager

## Contract
Apply this skill when the task involves managing agent configurations, installing or adapting project-local skills, checking agent health, or configuring Git policies using \`initskill\`.

## When to Use
- Initializing agent rules and skills in a workspace: \`initskill init\`
- Running diagnostic health checks on workspace agent setup: \`initskill doctor\`
- Listing available built-in skills and profiles: \`initskill list\`
- Managing project-local skills: \`initskill skill list|create|update|validate|inspect\`
- Setting repository commit policy: \`initskill config git-policy\`

## Common Commands Reference

### 1. Workspace Diagnostics
\`\`\`text
initskill doctor --json
initskill doctor --target both --mode auto --json
\`\`\`

### 2. Initializing a Workspace
\`\`\`text
# Standard interactive setup
initskill

# Automated / non-interactive initialization
initskill init --target both --mode agent --profile general --non-interactive
initskill init --target antigravity --non-interactive
initskill init --rules developer-implementation,tester-qa-strategy --non-interactive
\`\`\`

### 3. Skill Lifecycle & Authoring
\`\`\`text
# List local skills
initskill skill list --json

# Inspect a specific skill
initskill skill inspect <name> --json

# Create a new local skill
initskill skill create <name> --description "Description of the skill" --json

# Validate all local skills
initskill skill validate --json
\`\`\`

### 4. Git Commit Policy
\`\`\`text
initskill config git-policy ask
initskill config git-policy auto
initskill config git-policy off
\`\`\`

## Verification
Always run \`initskill doctor --json\` after running \`initskill init\` or modifying agent configurations to ensure all files and manifests are valid.
`;

const initskillDir = join(targetSkillsDir, 'initskill');
if (!existsSync(initskillDir)) {
  mkdirSync(initskillDir, { recursive: true });
}
const initskillPath = join(initskillDir, 'SKILL.md');
writeFileSync(initskillPath, initskillSkill, 'utf8');
console.log('[OK] Exported CLI skill: initskill');

console.log(`\nSuccessfully exported all skills to ${targetSkillsDir}`);
