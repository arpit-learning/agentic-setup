import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { AGENTIC_MANAGED_PREFIX } from '../../fingerprint/existing-config.js';
import type { Check } from '../index.js';
import {
  POINTS_CLAUDE_MD_EXISTS,
  POINTS_CURSOR_RULES_EXIST,
  POINTS_CURSOR_MDC_RULES,
  POINTS_MCP_SERVERS,
  POINTS_CLAUDE_RULES,
  POINTS_CROSS_PLATFORM_PARITY,
} from '../constants.js';

function countFiles(dir: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => pattern.test(f));
  } catch {
    return [];
  }
}

function hasMcpServers(dir: string): { count: number; sources: string[] } {
  const sources: string[] = [];
  let count = 0;

  const mcpFiles = [
    '.mcp.json',
    '.cursor/mcp.json',
    '.claude/settings.local.json',
    '.claude/settings.json',
  ];

  for (const rel of mcpFiles) {
    try {
      const content = readFileSync(join(dir, rel), 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const servers = parsed.mcpServers as Record<string, unknown> | undefined;
      if (servers && Object.keys(servers).length > 0) {
        count += Object.keys(servers).length;
        sources.push(rel);
      }
    } catch {
      // file doesn't exist or isn't valid JSON
    }
  }

  return { count, sources };
}

function hasCopilotInstructions(dir: string): { found: boolean; source?: string } {
  const copilotPath = join(dir, '.github', 'copilot-instructions.md');
  if (existsSync(copilotPath)) {
    return { found: true, source: '.github/copilot-instructions.md' };
  }
  try {
    const instructionsDir = join(dir, '.github', 'instructions');
    const files = readdirSync(instructionsDir).filter((f) => f.endsWith('.md'));
    if (files.length > 0) {
      return {
        found: true,
        source: `.github/instructions/ (${files.length} file${files.length === 1 ? '' : 's'})`,
      };
    }
  } catch {
    /* dir missing */
  }
  return { found: false };
}

export function checkExistence(dir: string): Check[] {
  const checks: Check[] = [];

  // 1. CLAUDE.md exists
  const claudeMdExists = existsSync(join(dir, 'CLAUDE.md'));
  checks.push({
    id: 'claude_md_exists',
    name: 'CLAUDE.md exists',
    category: 'existence',
    maxPoints: POINTS_CLAUDE_MD_EXISTS,
    earnedPoints: claudeMdExists ? POINTS_CLAUDE_MD_EXISTS : 0,
    passed: claudeMdExists,
    detail: claudeMdExists ? 'Found at project root' : 'Not found',
    suggestion: claudeMdExists ? undefined : 'Create a CLAUDE.md with project context and commands',
    fix: claudeMdExists
      ? undefined
      : {
          action: 'create_file',
          data: { file: 'CLAUDE.md' },
          instruction:
            'Create CLAUDE.md with project context, commands, architecture, and conventions.',
        },
  });

  // 2. .claude/rules/*.md exists (path-scoped rules)
  const claudeRulesDir = join(dir, '.claude', 'rules');
  let claudeRuleFiles: string[] = [];
  if (existsSync(claudeRulesDir)) {
    try {
      claudeRuleFiles = readdirSync(claudeRulesDir).filter(
        (f) => f.endsWith('.md') && !f.startsWith(AGENTIC_MANAGED_PREFIX),
      );
    } catch {
      /* ignore */
    }
  }
  const hasClaudeRules = claudeRuleFiles.length > 0;
  checks.push({
    id: 'claude_rules_exist',
    name: 'Claude rules exist (.claude/rules/)',
    category: 'existence',
    maxPoints: POINTS_CLAUDE_RULES,
    earnedPoints: hasClaudeRules ? POINTS_CLAUDE_RULES : 0,
    passed: hasClaudeRules,
    detail: hasClaudeRules
      ? `${claudeRuleFiles.length} rule${claudeRuleFiles.length === 1 ? '' : 's'} found`
      : 'No .claude/rules/*.md files',
    suggestion: hasClaudeRules
      ? undefined
      : 'Add .claude/rules/*.md with path-scoped conventions for better context efficiency',
    fix: hasClaudeRules
      ? undefined
      : {
          action: 'create_file',
          data: { file: '.claude/rules/' },
          instruction:
            'Create .claude/rules/ with path-scoped markdown rules (e.g., testing-patterns.md, api-conventions.md).',
        },
  });

  // 3. .cursorrules or .cursor/rules/ exists
  const hasCursorrules = existsSync(join(dir, '.cursorrules'));
  const cursorRulesDir = existsSync(join(dir, '.cursor', 'rules'));
  const cursorRulesExist = hasCursorrules || cursorRulesDir;
  checks.push({
    id: 'cursor_rules_exist',
    name: 'Cursor rules exist',
    category: 'existence',
    maxPoints: POINTS_CURSOR_RULES_EXIST,
    earnedPoints: cursorRulesExist ? POINTS_CURSOR_RULES_EXIST : 0,
    passed: cursorRulesExist,
    detail: hasCursorrules
      ? '.cursorrules found'
      : cursorRulesDir
        ? '.cursor/rules/ found'
        : 'No Cursor rules',
    suggestion: cursorRulesExist ? undefined : 'Add .cursor/rules/ for Cursor users on your team',
    fix: cursorRulesExist
      ? undefined
      : {
          action: 'create_file',
          data: { file: '.cursor/rules/' },
          instruction: 'Create .cursor/rules/ with project-specific Cursor rules.',
        },
  });

  // 2b. AGENTS.md exists (primary config for Codex)
  const agentsMdExists = existsSync(join(dir, 'AGENTS.md'));
  checks.push({
    id: 'codex_agents_md_exists',
    name: 'AGENTS.md exists',
    category: 'existence',
    maxPoints: POINTS_CLAUDE_MD_EXISTS,
    earnedPoints: agentsMdExists ? POINTS_CLAUDE_MD_EXISTS : 0,
    passed: agentsMdExists,
    detail: agentsMdExists ? 'Found at project root' : 'Not found',
    suggestion: agentsMdExists ? undefined : 'Create AGENTS.md with project context for Codex',
    fix: agentsMdExists
      ? undefined
      : {
          action: 'create_file',
          data: { file: 'AGENTS.md' },
          instruction: 'Create AGENTS.md with project context for Codex.',
        },
  });

  // 2c. Copilot instructions exist
  const copilot = hasCopilotInstructions(dir);
  checks.push({
    id: 'copilot_instructions_exists',
    name: 'Copilot instructions exist',
    category: 'existence',
    maxPoints: POINTS_CLAUDE_MD_EXISTS,
    earnedPoints: copilot.found ? POINTS_CLAUDE_MD_EXISTS : 0,
    passed: copilot.found,
    detail: copilot.found ? `Found at ${copilot.source}` : 'Not found',
    suggestion: copilot.found
      ? undefined
      : 'Create .github/copilot-instructions.md or .github/instructions/*.md for GitHub Copilot',
    fix: copilot.found
      ? undefined
      : {
          action: 'create_file',
          data: { file: '.github/copilot-instructions.md' },
          instruction:
            'Create .github/copilot-instructions.md or .github/instructions/ for GitHub Copilot.',
        },
  });

  // 2d. OpenCode config exists
  const opencodeDir = join(dir, '.opencode');
  const opencodeExists = existsSync(opencodeDir);
  checks.push({
    id: 'opencode_config_exists',
    name: 'OpenCode config exists',
    category: 'existence',
    maxPoints: POINTS_CLAUDE_MD_EXISTS,
    earnedPoints: opencodeExists ? POINTS_CLAUDE_MD_EXISTS : 0,
    passed: opencodeExists,
    detail: opencodeExists ? 'Found .opencode/' : 'Not found',
    suggestion: opencodeExists ? undefined : 'Create .opencode/ with OpenCode agent configuration',
    fix: opencodeExists
      ? undefined
      : {
          action: 'create_file',
          data: { file: '.opencode/' },
          instruction: 'Create .opencode/ directory with OpenCode configuration.',
        },
  });

  // 2e. Antigravity IDE config exists
  const antigravityDir = join(dir, '.gemini');
  const antigravityExists = existsSync(antigravityDir);
  checks.push({
    id: 'antigravity_config_exists',
    name: 'Antigravity IDE config exists',
    category: 'existence',
    maxPoints: POINTS_CLAUDE_MD_EXISTS,
    earnedPoints: antigravityExists ? POINTS_CLAUDE_MD_EXISTS : 0,
    passed: antigravityExists,
    detail: antigravityExists ? 'Found .gemini/' : 'Not found',
    suggestion: antigravityExists
      ? undefined
      : 'Create .gemini/rules/ with Antigravity agent configuration',
    fix: antigravityExists
      ? undefined
      : {
          action: 'create_file',
          data: { file: '.gemini/rules/' },
          instruction: 'Create .gemini/rules/ directory with Antigravity configuration.',
        },
  });

  // 3. Cursor .mdc rules
  const mdcFiles = countFiles(join(dir, '.cursor', 'rules'), /\.mdc$/);
  const mdcCount = mdcFiles.length;
  checks.push({
    id: 'cursor_mdc_rules',
    name: 'Cursor .mdc rules',
    category: 'existence',
    maxPoints: POINTS_CURSOR_MDC_RULES,
    earnedPoints: mdcCount >= 1 ? POINTS_CURSOR_MDC_RULES : 0,
    passed: mdcCount >= 1,
    detail:
      mdcCount === 0
        ? 'No .mdc rule files'
        : `${mdcCount} .mdc rule${mdcCount === 1 ? '' : 's'} found`,
    suggestion:
      mdcCount === 0
        ? 'Cursor .mdc rules use frontmatter to scope rules to specific files/paths. Add them for more targeted Cursor behavior'
        : undefined,
    fix:
      mdcCount === 0
        ? {
            action: 'create_mdc_rules',
            data: {},
            instruction: 'Create .cursor/rules/*.mdc files with YAML frontmatter for Cursor.',
          }
        : undefined,
  });

  // 5. MCP servers configured
  const mcp = hasMcpServers(dir);
  checks.push({
    id: 'mcp_servers',
    name: 'MCP servers configured',
    category: 'existence',
    maxPoints: mcp.count >= 1 ? POINTS_MCP_SERVERS : 0,
    earnedPoints: mcp.count >= 1 ? POINTS_MCP_SERVERS : 0,
    passed: mcp.count >= 1,
    detail:
      mcp.count > 0
        ? `${mcp.count} server${mcp.count === 1 ? '' : 's'} in ${mcp.sources.join(', ')}`
        : 'No MCP servers configured',
    suggestion:
      mcp.count === 0
        ? 'MCP servers connect your agent to external tools (databases, Slack, Linear, etc). Add if your team uses external services'
        : undefined,
    fix:
      mcp.count === 0
        ? {
            action: 'configure_mcp',
            data: {},
            instruction:
              'Add MCP server configurations in .mcp.json for any external services the project uses.',
          }
        : undefined,
  });

  // 6. Cross-platform parity
  const hasClaudeConfigs = claudeMdExists;
  const hasCursorConfigs = cursorRulesExist || mdcCount > 0;
  const hasParity = hasClaudeConfigs && hasCursorConfigs;
  checks.push({
    id: 'cross_platform_parity',
    name: 'Cross-platform parity',
    category: 'existence',
    maxPoints: POINTS_CROSS_PLATFORM_PARITY,
    earnedPoints: hasParity ? POINTS_CROSS_PLATFORM_PARITY : 0,
    passed: hasParity,
    detail: hasParity
      ? 'Both Claude Code and Cursor configured'
      : hasClaudeConfigs
        ? 'Only Claude Code — no Cursor configs'
        : hasCursorConfigs
          ? 'Only Cursor — no Claude Code configs'
          : 'Neither platform configured',
    suggestion: hasParity
      ? undefined
      : 'Add configs for both platforms so all teammates get context',
    fix: hasParity
      ? undefined
      : {
          action: 'add_platform',
          data: { hasClaude: hasClaudeConfigs, hasCursor: hasCursorConfigs },
          instruction: hasClaudeConfigs
            ? 'Add Cursor rules (.cursor/rules/) for cross-platform support.'
            : 'Add CLAUDE.md for cross-platform support.',
        },
  });

  return checks;
}
