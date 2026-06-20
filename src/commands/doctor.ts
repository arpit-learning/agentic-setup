import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { computeLocalScore } from '../scoring/index.js';
import { checkCodegraphCli, getCodegraphStats, readMcpConfig } from '../extensions/codegraph.js';
import { readProjectConfig } from '../lib/project-config.js';
import { loadConfig } from '../llm/config.js';
import { isPreCommitHookInstalled, isPreCommitHookCurrent } from '../lib/hooks.js';
import { AGENTIC_DIR } from '../constants.js';

export interface DoctorCheck {
  label: string;
  ok: boolean;
  critical: boolean;
  hint?: string;
}

interface DoctorOptions {
  json?: boolean;
  soft?: boolean;
}

function isGitRepo(repoRoot: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function mcpConfigValid(repoRoot: string): boolean {
  for (const rel of ['.cursor/mcp.json', '.mcp.json']) {
    const file = path.join(repoRoot, rel);
    if (!fs.existsSync(file)) continue;
    try {
      JSON.parse(fs.readFileSync(file, 'utf-8'));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function analysisFresh(repoRoot: string, maxAgeDays = 7): boolean {
  const file = path.join(repoRoot, AGENTIC_DIR, 'analysis', 'latest.json');
  if (!fs.existsSync(file)) return false;
  try {
    const ageMs = Date.now() - fs.statSync(file).mtimeMs;
    return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function collectDoctorChecks(repoRoot: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const config = readProjectConfig(repoRoot);
  const threshold = config.config_score_threshold;

  function add(label: string, ok: boolean, critical = false, hint?: string): void {
    checks.push({ label, ok, critical, hint });
  }

  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  add('Node.js >= 20', nodeMajor >= 20, true);
  add('Git repository', isGitRepo(repoRoot), false, 'Hooks require git');

  const hasClaude = fs.existsSync(path.join(repoRoot, 'CLAUDE.md'));
  const hasAgents = fs.existsSync(path.join(repoRoot, 'AGENTS.md'));
  add(
    'Agent config present (CLAUDE.md or AGENTS.md)',
    hasClaude || hasAgents,
    true,
    'Run: agentic-setup init',
  );
  add('Cursor rules configured', fs.existsSync(path.join(repoRoot, '.cursor', 'rules')), false);
  add(
    'run.md present',
    fs.existsSync(path.join(repoRoot, 'run.md')),
    false,
    'Run: agentic-setup init',
  );

  add('LLM provider configured', !!loadConfig(), false, 'Run: agentic-setup config');

  add(
    'Pre-commit hook installed',
    isPreCommitHookInstalled(),
    false,
    'Run: agentic-setup hooks --install',
  );
  add(
    'Pre-commit hook current',
    isPreCommitHookCurrent(),
    false,
    'Run: agentic-setup hooks --install',
  );

  add('MCP config parseable', mcpConfigValid(repoRoot), false);

  const mcp = readMcpConfig(repoRoot);
  add(
    'Codegraph in .cursor/mcp.json',
    mcp.hasCodegraph,
    true,
    'Run: agentic-setup codegraph setup',
  );
  add(
    'Codegraph in .vscode/mcp.json',
    fs.existsSync(path.join(repoRoot, '.vscode', 'mcp.json')),
    false,
    'Run: agentic-setup codegraph setup',
  );
  add(
    'Codegraph in .windsurf/mcp.json',
    fs.existsSync(path.join(repoRoot, '.windsurf', 'mcp.json')),
    false,
    'Run: agentic-setup codegraph setup',
  );
  add(
    'Codegraph in .devin/mcp.json',
    fs.existsSync(path.join(repoRoot, '.devin', 'mcp.json')),
    false,
    'Run: agentic-setup codegraph setup',
  );
  add(
    'Codegraph in .codex/mcp.json',
    fs.existsSync(path.join(repoRoot, '.codex', 'mcp.json')),
    false,
    'Run: agentic-setup codegraph setup',
  );
  add(
    'Codegraph in .idea/mcp.json',
    fs.existsSync(path.join(repoRoot, '.idea', 'mcp.json')),
    false,
    'Run: agentic-setup codegraph setup',
  );

  const stats = getCodegraphStats(repoRoot);
  add('Codegraph index exists', stats.indexed, true, 'Run: agentic-setup codegraph setup');

  const cgCli = checkCodegraphCli(repoRoot);
  add('Codegraph engine ready', cgCli.available, false, 'Node.js is required for codegraph');

  add(
    'index-codegraph.js exists',
    fs.existsSync(path.join(repoRoot, '.agentic-setup', 'index-codegraph.js')),
    false,
  );

  add(
    'codegraph-mcp-server.js exists',
    fs.existsSync(path.join(repoRoot, '.agentic-setup', 'codegraph-mcp-server.js')),
    false,
  );

  add('Analysis artifact fresh', analysisFresh(repoRoot), false, 'Run: agentic-setup analyze');

  add(
    `.agentic-setup.yaml present`,
    fs.existsSync(path.join(repoRoot, '.agentic-setup.yaml')),
    false,
    'Run: agentic-setup setup',
  );

  const configScore = computeLocalScore(repoRoot, config.agents);
  add(
    `Config score ≥ ${threshold} (${configScore.score}/100)`,
    configScore.score >= threshold,
    false,
    'Run: agentic-setup score',
  );

  return checks;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  const checks = collectDoctorChecks(repoRoot);
  const configScore = computeLocalScore(repoRoot);

  if (options.json) {
    console.log(JSON.stringify({ checks, config_score: configScore.score }, null, 2));
  } else {
    console.log('');
    console.log(chalk.bold.cyan('  agentic-setup — Doctor'));
    console.log('');
    for (const c of checks) {
      if (c.ok) console.log(chalk.green(`  ✓ ${c.label}`));
      else if (c.critical) console.log(chalk.red(`  ✗ ${c.label}${c.hint ? ` — ${c.hint}` : ''}`));
      else console.log(chalk.yellow(`  ! ${c.label}${c.hint ? ` — ${c.hint}` : ''}`));
    }
    console.log('');
  }

  const criticalFails = checks.filter((c) => c.critical && !c.ok);
  if (criticalFails.length > 0 && !options.soft) {
    throw new Error(`${criticalFails.length} critical check(s) failed`);
  }
}
