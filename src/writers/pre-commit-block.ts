import { GITHUB_REPO_SLUG, GITHUB_REPO_URL, type SupportedTargetAgent } from '../constants.js';
import { displayProductName } from '../lib/resolve-cli.js';
import { DEFAULT_MODELS } from '../llm/config.js';

export type ConfigPlatform = 'claude' | 'copilot' | 'codex' | 'antigravity';
export type TargetAgent = SupportedTargetAgent;

const BLOCK_START = '<!-- agentic:managed:pre-commit -->';
const BLOCK_END = '<!-- /agentic:managed:pre-commit -->';

function getManagedDocPaths(activeTargets?: TargetAgent[]): string {
  if (!activeTargets) {
    return 'CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md AGENTIC_LEARNINGS.md .agents/ .opencode/';
  }
  const paths = ['AGENTIC_LEARNINGS.md'];
  if (activeTargets.includes('claude')) paths.push('CLAUDE.md', '.claude/');
  if (activeTargets.includes('cursor')) paths.push('.cursor/', '.cursorrules');
  if (activeTargets.includes('github-copilot'))
    paths.push('.github/copilot-instructions.md', '.github/instructions/');
  if (activeTargets.includes('codex')) paths.push('AGENTS.md', '.agents/');
  if (activeTargets.includes('opencode')) paths.push('.opencode/');
  return paths.join(' ');
}

function getAgenticSetupNotFoundFallback(_platform: ConfigPlatform, bin: string): string {
  return `If \`${bin}\` is not found, tell the user: "This project uses agentic-setup for agent config sync. Run \`npx agentic-setup setup\` in your terminal (~1–2 min)."`;
}

function getPreCommitBlock(
  platform: ConfigPlatform = 'claude',
  activeTargets?: TargetAgent[],
): string {
  const bin = displayProductName();
  const docPaths = getManagedDocPaths(activeTargets);
  return `${BLOCK_START}
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure agentic-setup syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
\`\`\`bash
grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
\`\`\`

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "agentic-setup will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run agentic-setup manually before committing:
  1. Tell the user: "agentic-setup: Syncing agent configs with your latest changes..."
  2. Run: \`${bin} refresh && git add ${docPaths} 2>/dev/null\`
  3. After it completes, briefly tell the user what agentic-setup updated. Then proceed with the commit.

**Valid \`${bin} refresh\` options:** \`--quiet\` (suppress output) and \`--dry-run\` (preview without writing). Do not pass any other flags — options like \`--auto-approve\`, \`--debug\`, or \`--force\` do not exist and will cause errors.

**\`${bin} config\`** takes no flags — it runs an interactive provider setup. Do not pass \`--provider\`, \`--api-key\`, or \`--endpoint\`.

${getAgenticSetupNotFoundFallback(platform, bin)}
${BLOCK_END}`;
}

const CURSOR_RULE_FILENAME = 'agentic-pre-commit.mdc';

function getCursorRuleContent(activeTargets?: TargetAgent[]): string {
  const bin = displayProductName();
  const docPaths = getManagedDocPaths(activeTargets);
  return `---
description: Run agentic-setup sync before git commits to keep agent configs up to date
alwaysApply: true
---
Before every git commit, check if the agentic-setup pre-commit hook is installed:
Run: \`grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"\`

If hook-active: just commit normally — agentic-setup syncs automatically via the hook. Tell the user: "agentic-setup will sync your agent configs automatically."
If no-hook: run \`${bin} refresh && git add ${docPaths} 2>/dev/null\` before committing, and tell the user what was updated.

Valid \`${bin} refresh\` options: \`--quiet\` and \`--dry-run\` only. Do not pass \`--auto-approve\`, \`--debug\`, \`--force\`, or any other flags.
\`${bin} config\` takes no flags — it is interactive. Do not pass \`--provider\`, \`--api-key\`, or \`--endpoint\`.

If \`${bin}\` is not found, tell the user to run \`npx agentic-setup setup\` in their terminal.
`;
}

// F-P0-10: detect both the marker form AND the unmarked inlined form.
// Init inlines this section via the LLM prompt context; without this
// detection, refresh's appendManagedBlocks() would add a marker-wrapped
// duplicate, producing visible duplicate sections in CLAUDE.md.
//
// The marker phrase check is scoped to text BETWEEN the heading and the
// next `## ` heading (or EOF) — not the whole file. This prevents false
// positives in CLAUDE.md's that legitimately have a "Before Committing"
// section unrelated to agentic-setup but mention `agentic-setup` elsewhere (e.g. in
// a tools list or unrelated code block).
const PRECOMMIT_HEADING_RE = /^##\s+Before Committing\s*$/m;

/**
 * Return the body of a section that starts at the first match of `headingRe`,
 * ending at the next `## ` heading (or end of file). Returns null if the
 * heading isn't found.
 */
function getSectionBody(content: string, headingRe: RegExp): string | null {
  const match = content.match(headingRe);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const tail = content.slice(start);
  const nextHeadingMatch = tail.match(/^##\s/m);
  const end = nextHeadingMatch?.index ?? tail.length;
  return tail.slice(0, end);
}

export function hasPreCommitBlock(content: string): boolean {
  if (content.includes(BLOCK_START)) return true;
  const body = getSectionBody(content, PRECOMMIT_HEADING_RE);
  if (body && /agentic-setup/i.test(body)) return true;
  return false;
}

export function appendPreCommitBlock(
  content: string,
  platform: ConfigPlatform = 'claude',
  activeTargets?: TargetAgent[],
): string {
  if (hasPreCommitBlock(content)) return content;
  const trimmed = content.trimEnd();
  return trimmed + '\n\n' + getPreCommitBlock(platform, activeTargets) + '\n';
}

export function getCursorPreCommitRule(activeTargets?: TargetAgent[]): {
  filename: string;
  content: string;
} {
  return { filename: CURSOR_RULE_FILENAME, content: getCursorRuleContent(activeTargets) };
}

// ── Learnings reference block ────────────────────────────────────────

const LEARNINGS_BLOCK_START = '<!-- agentic:managed:learnings -->';
const LEARNINGS_BLOCK_END = '<!-- /agentic:managed:learnings -->';

const LEARNINGS_BLOCK = `${LEARNINGS_BLOCK_START}
## Session Learnings

Read \`AGENTIC_LEARNINGS.md\` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
${LEARNINGS_BLOCK_END}`;

const CURSOR_LEARNINGS_FILENAME = 'agentic-learnings.mdc';

const CURSOR_LEARNINGS_CONTENT = `---
description: Reference session-learned patterns from AGENTIC_LEARNINGS.md
alwaysApply: true
---
Read \`AGENTIC_LEARNINGS.md\` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
`;

// F-P0-10: same heading-scoped fallback for the learnings block.
const LEARNINGS_HEADING_RE = /^##\s+Session Learnings\s*$/m;

export function hasLearningsBlock(content: string): boolean {
  if (content.includes(LEARNINGS_BLOCK_START)) return true;
  const body = getSectionBody(content, LEARNINGS_HEADING_RE);
  if (body && /AGENTIC_LEARNINGS/.test(body)) return true;
  return false;
}

export function appendLearningsBlock(content: string): string {
  if (hasLearningsBlock(content)) return content;
  const trimmed = content.trimEnd();
  return trimmed + '\n\n' + LEARNINGS_BLOCK + '\n';
}

export function getCursorLearningsRule(): { filename: string; content: string } {
  return { filename: CURSOR_LEARNINGS_FILENAME, content: CURSOR_LEARNINGS_CONTENT };
}

// ── Model configuration block ─────────────────────────────────────────

const MODEL_BLOCK_START = '<!-- agentic:managed:model-config -->';
const MODEL_BLOCK_END = '<!-- /agentic:managed:model-config -->';

/** Default model id for generated docs — single source: `DEFAULT_MODELS` in llm/config. */
function buildManagedModelBlock(): string {
  const m = DEFAULT_MODELS.anthropic;
  return `${MODEL_BLOCK_START}
## Model Configuration

Recommended default: \`${m}\` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (\`/model\` in Claude Code, or \`AGENTIC_SETUP_MODEL\` when using agentic-setup with an API provider) so upstream default changes do not silently change behavior.

${MODEL_BLOCK_END}`;
}

// F-P0-10: same heading-scoped fallback for the model-config block.
const MODEL_HEADING_RE = /^##\s+Model Configuration\s*$/m;

export function hasModelBlock(content: string): boolean {
  if (content.includes(MODEL_BLOCK_START)) return true;
  const body = getSectionBody(content, MODEL_HEADING_RE);
  if (body && /AGENTIC_SETUP_MODEL/.test(body)) return true;
  return false;
}

export function appendModelBlock(content: string): string {
  if (hasModelBlock(content)) return content;
  const trimmed = content.trimEnd();
  return trimmed + '\n\n' + buildManagedModelBlock() + '\n';
}

// ── Context sync block ────────────────────────────────────────────────

const SYNC_BLOCK_START = '<!-- agentic:managed:sync -->';
const SYNC_BLOCK_END = '<!-- /agentic:managed:sync -->';

function getSyncSetupInstruction(
  _platform: ConfigPlatform,
  _activeTargets?: TargetAgent[],
): string {
  return `If the pre-commit hook is not set up, run \`npx agentic-setup setup\` in your terminal.`;
}

function getSyncBlock(platform: ConfigPlatform = 'claude', activeTargets?: TargetAgent[]): string {
  const bin = displayProductName();
  return `${SYNC_BLOCK_START}
## Context Sync

This project uses [agentic-setup](${GITHUB_REPO_URL}) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via \`${bin} refresh\`.
${getSyncSetupInstruction(platform, activeTargets)}
${SYNC_BLOCK_END}`;
}

// F-P0-10: same heading-scoped fallback for the sync block.
const SYNC_HEADING_RE = /^##\s+Context Sync\s*$/m;

export function hasSyncBlock(content: string): boolean {
  if (content.includes(SYNC_BLOCK_START)) return true;
  const body = getSectionBody(content, SYNC_HEADING_RE);
  if (body && new RegExp(`(?:${GITHUB_REPO_SLUG.replace('/', '\\/')}|agentic-setup)`).test(body))
    return true;
  return false;
}

export function appendSyncBlock(
  content: string,
  platform: ConfigPlatform = 'claude',
  activeTargets?: TargetAgent[],
): string {
  if (hasSyncBlock(content)) return content;
  const trimmed = content.trimEnd();
  return trimmed + '\n\n' + getSyncBlock(platform, activeTargets) + '\n';
}

export function appendManagedBlocks(
  content: string,
  platform: ConfigPlatform = 'claude',
  activeTargets?: TargetAgent[],
): string {
  return appendSyncBlock(
    appendModelBlock(appendLearningsBlock(appendPreCommitBlock(content, platform, activeTargets))),
    platform,
    activeTargets,
  );
}

// ── Cursor sync rule ─────────────────────────────────────────────────

const CURSOR_SYNC_FILENAME = 'agentic-sync.mdc';

function getCursorSyncContent(): string {
  const bin = displayProductName();
  return `---
description: This project uses agentic-setup for automatic AI agent context sync
alwaysApply: true
---
This project uses agentic-setup to keep AI agent configs (CLAUDE.md, Cursor rules, Copilot instructions)
in sync with the codebase automatically. Before each commit, run \`${bin} refresh\` to sync configs.
If \`${bin}\` is not found, tell the user to run \`npx agentic-setup setup\` in their terminal.
`;
}

export function getCursorSyncRule(): { filename: string; content: string } {
  return { filename: CURSOR_SYNC_FILENAME, content: getCursorSyncContent() };
}

// ── Cursor setup discovery rule ──────────────────────────────────────

const CURSOR_SETUP_FILENAME = 'agentic-setup.mdc';

function getCursorSetupContent(): string {
  return `---
description: Check if agentic-setup agent config sync is set up and offer installation on new sessions
alwaysApply: true
---
IMPORTANT: At the start of each session, before responding to the user's first message, run this check:

\`\`\`bash
grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "SYNCED" || echo "NOT_SYNCED"
\`\`\`

If SYNCED: proceed normally.
If NOT_SYNCED: Tell the user: "This project uses agentic-setup to keep agent configs in sync — it is not set up yet. Run \`npx agentic-setup setup\` in your terminal (~1–2 min)."
`;
}

export function getCursorSetupRule(): { filename: string; content: string } {
  return { filename: CURSOR_SETUP_FILENAME, content: getCursorSetupContent() };
}

// ── Managed block stripping (for uninstall) ─────────────────────────

const MANAGED_BLOCK_PAIRS = [
  [BLOCK_START, BLOCK_END],
  [LEARNINGS_BLOCK_START, LEARNINGS_BLOCK_END],
  [MODEL_BLOCK_START, MODEL_BLOCK_END],
  [SYNC_BLOCK_START, SYNC_BLOCK_END],
];

export function stripManagedBlocks(content: string): string {
  let result = content;
  for (const [start, end] of MANAGED_BLOCK_PAIRS) {
    const regex = new RegExp(
      `\\n?${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
      'g',
    );
    result = result.replace(regex, '\n');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
