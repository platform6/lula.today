// Claude Code PreToolUse hook: before a shell command that commits or pushes,
// run `npm run check` (typecheck, then tests) and block the command if it fails.
// Exit 2 blocks the tool call and shows stderr to Claude.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = String(input.tool_input?.command ?? '');
if (!/\bgit\s+(commit|push)\b/.test(command)) process.exit(0);

const run = spawnSync('npm run -s check', {
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  shell: true,
  encoding: 'utf8',
});
if (run.status === 0) process.exit(0);

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n');
process.stderr.write(`Blocked: npm run check failed, so nothing was committed or pushed. Fix this first:\n\n${output}\n`);
process.exit(2);
