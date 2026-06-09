import { existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import type { Check } from '../index.js';
import {
  POINTS_HOOKS,
  POINTS_AGENTS_MD,
  POINTS_LEARNED_CONTENT,
  POINTS_MODEL_PINNED,
  POINTS_RUN_MD,
  POINTS_SKILLS_CONFIGURED,
} from '../constants.js';
import { displayProductName } from '../../lib/resolve-cli.js';
import { readFileOrNull } from '../utils.js';
import { hasPreCommitBlock as checkPreCommitBlock } from '../../writers/pre-commit-block.js';
import { configContentSuggestsPinnedModel } from '../model-pinning.js';

function countSkillPackages(dir: string): number {
  let count = 0;
  for (const skillsDir of [
    join(dir, '.claude', 'skills'),
    join(dir, '.cursor', 'skills'),
    join(dir, '.agents', 'skills'),
    join(dir, '.opencode', 'skills'),
  ]) {
    try {
      for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(skillsDir, entry.name, 'SKILL.md'))) {
          count++;
        }
      }
    } catch {
      /* dir missing */
    }
  }
  return count;
}

function hasPreCommitHook(dir: string): boolean {
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const hookPath = join(gitDir, 'hooks', 'pre-commit');
    const content = readFileOrNull(hookPath);
    return content ? content.includes('agentic-setup') : false;
  } catch {
    return false;
  }
}

export function checkBonus(dir: string): Check[] {
  const checks: Check[] = [];

  // 1. Hooks configured
  let hasClaudeHooks = false;
  let hasPrecommit = false;
  const hookSources: string[] = [];

  const settingsContent = readFileOrNull(join(dir, '.claude', 'settings.json'));
  if (settingsContent) {
    try {
      const settings = JSON.parse(settingsContent) as Record<string, unknown>;
      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (hooks && Object.keys(hooks).length > 0) {
        hasClaudeHooks = true;
        hookSources.push(`Claude Code: ${Object.keys(hooks).join(', ')}`);
      }
    } catch {
      /* invalid JSON */
    }
  }

  hasPrecommit = hasPreCommitHook(dir);
  if (hasPrecommit) {
    hookSources.push('git pre-commit');
  }

  const claudeMd = readFileOrNull(join(dir, 'CLAUDE.md'));
  const hasPreCommitBlock = claudeMd ? checkPreCommitBlock(claudeMd) : false;
  if (hasPreCommitBlock) {
    hookSources.push('config pre-commit instruction');
  }

  const hasHooks = hasClaudeHooks || hasPrecommit || hasPreCommitBlock;
  checks.push({
    id: 'hooks_configured',
    name: 'Hooks configured',
    category: 'bonus',
    maxPoints: POINTS_HOOKS,
    earnedPoints: hasHooks ? POINTS_HOOKS : 0,
    passed: hasHooks,
    detail: hasHooks ? hookSources.join(', ') : 'No hooks configured',
    suggestion: hasHooks
      ? undefined
      : `Hooks auto-sync your agent config on every commit so it stays fresh. Run \`${displayProductName()} init\` to set up`,
    fix: hasHooks
      ? undefined
      : {
          action: 'install_hooks',
          data: {},
          instruction: `Run ${displayProductName()} init to add pre-commit refresh instructions to config files.`,
        },
  });

  // 2. AGENTS.md exists (bonus for non-codex targets — codex has its own existence check)
  const agentsMdExists = existsSync(join(dir, 'AGENTS.md'));
  checks.push({
    id: 'agents_md_exists',
    name: 'AGENTS.md exists',
    category: 'bonus',
    maxPoints: POINTS_AGENTS_MD,
    earnedPoints: agentsMdExists ? POINTS_AGENTS_MD : 0,
    passed: agentsMdExists,
    detail: agentsMdExists ? 'Found at project root' : 'Not found',
    suggestion: agentsMdExists
      ? undefined
      : 'AGENTS.md provides project context to Codex, Copilot, and other agents. Works alongside CLAUDE.md',
    fix: agentsMdExists
      ? undefined
      : {
          action: 'create_file',
          data: { file: 'AGENTS.md' },
          instruction: 'Create AGENTS.md with project context for cross-agent compatibility.',
        },
  });

  // 3. Learned content present
  const learningsContent = readFileOrNull(join(dir, 'AGENTIC_LEARNINGS.md'));
  const hasLearned = learningsContent
    ? learningsContent.split('\n').filter((l) => l.startsWith('- ')).length > 0
    : false;

  checks.push({
    id: 'learned_content',
    name: 'Learned content present',
    category: 'bonus',
    maxPoints: POINTS_LEARNED_CONTENT,
    earnedPoints: hasLearned ? POINTS_LEARNED_CONTENT : 0,
    passed: hasLearned,
    detail: hasLearned ? 'Session learnings found in AGENTIC_LEARNINGS.md' : 'No learned content',
    suggestion: hasLearned
      ? undefined
      : `Session learnings capture patterns from your coding sessions so the agent improves over time. Run \`${displayProductName()} learn install\``,
  });

  // 4. Skills configured
  const skillCount = countSkillPackages(dir);
  checks.push({
    id: 'skills_configured',
    name: 'Skills configured',
    category: 'bonus',
    maxPoints: POINTS_SKILLS_CONFIGURED,
    earnedPoints: skillCount > 0 ? POINTS_SKILLS_CONFIGURED : 0,
    passed: skillCount > 0,
    detail:
      skillCount > 0
        ? `${skillCount} skill${skillCount === 1 ? '' : 's'} with SKILL.md`
        : 'No skill directories found',
    suggestion:
      skillCount > 0
        ? undefined
        : `Add agent skills under .claude/skills/, .cursor/skills/, or .agents/skills/ with SKILL.md files`,
  });

  // 5. Model and effort level pinned
  const configContent = (() => {
    const parts: string[] = [];
    for (const rel of ['CLAUDE.md', 'AGENTS.md'] as const) {
      const c = readFileOrNull(join(dir, rel));
      if (c) parts.push(c);
    }
    try {
      const rulesDir = join(dir, '.cursor', 'rules');
      for (const f of readdirSync(rulesDir).filter((x) => x.endsWith('.mdc'))) {
        const content = readFileOrNull(join(rulesDir, f));
        if (content) parts.push(content);
      }
    } catch {
      /* dir missing */
    }
    return parts.join('\n').toLowerCase();
  })();

  const hasModelRef = configContentSuggestsPinnedModel(configContent);

  checks.push({
    id: 'model_pinned',
    name: 'Model & effort pinned',
    category: 'bonus',
    maxPoints: POINTS_MODEL_PINNED,
    earnedPoints: hasModelRef ? POINTS_MODEL_PINNED : 0,
    passed: hasModelRef,
    detail: hasModelRef
      ? 'Model or effort level explicitly set in config'
      : "Config doesn't pin model or effort level — behavior may change when defaults are updated",
    suggestion: hasModelRef
      ? undefined
      : 'Add model/effort to config: AGENTIC_SETUP_MODEL env var, or /model in Claude Code, or a Model Configuration section in CLAUDE.md',
  });

  // 6. run.md with startup + health hints
  const runMd = readFileOrNull(join(dir, 'run.md'));
  const hasRunMd =
    !!runMd &&
    /startup_command|npm run|gradlew|uvicorn|go run/i.test(runMd) &&
    /health|base_url|localhost/i.test(runMd);
  checks.push({
    id: 'run_md_present',
    name: 'run.md local dev guide',
    category: 'bonus',
    maxPoints: POINTS_RUN_MD,
    earnedPoints: hasRunMd ? POINTS_RUN_MD : 0,
    passed: hasRunMd,
    detail: hasRunMd
      ? 'run.md documents startup and health checks'
      : 'run.md missing or incomplete',
    suggestion: hasRunMd
      ? undefined
      : 'Add run.md with startup_command, base_url, and health_endpoint for agents and CI',
    fix: hasRunMd
      ? undefined
      : {
          action: 'create_run_md',
          data: { file: 'run.md' },
          instruction: 'Create run.md documenting how to start the app and verify health locally.',
        },
  });

  return checks;
}
