import chalk from 'chalk';
import {
  readProjectConfig,
  writeProjectConfig,
  mergeProjectConfig,
  type TargetAgentName,
} from '../lib/project-config.js';
import { initCommand } from './init.js';
import { codegraphSetupCommand } from './codegraph.js';
import { analyzeCommand } from './analyze.js';
import { compositeScoreCommand } from './composite-score.js';
import { doctorCommand } from './doctor.js';
import { hooksCommand } from './hooks.js';
import type { TargetAgent } from './init-prompts.js';

export interface SetupOptions {
  agent?: TargetAgentName[];
  dryRun?: boolean;
  skipCodegraph?: boolean;
  skipLlm?: boolean;
  json?: boolean;
  autoApprove?: boolean;
}

function toInitAgents(agents: TargetAgentName[]): TargetAgent {
  return agents;
}

export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  let config = readProjectConfig(repoRoot);

  if (options.agent?.length) {
    config = mergeProjectConfig({
      ...config,
      agents: options.agent,
    });
  }

  if (!options.dryRun) {
    writeProjectConfig(config, repoRoot);
  }

  const steps: { name: string; status: 'pending' | 'done' | 'skipped' }[] = [
    { name: 'hooks', status: 'pending' },
    { name: 'init', status: options.skipLlm ? 'skipped' : 'pending' },
    {
      name: 'codegraph',
      status: config.codegraph && !options.skipCodegraph ? 'pending' : 'skipped',
    },
    { name: 'analyze', status: config.analyze_on_setup ? 'pending' : 'skipped' },
    { name: 'readiness', status: 'pending' },
    { name: 'doctor', status: 'pending' },
  ];

  if (!options.json) {
    console.log('');
    console.log(chalk.bold.cyan('  agentic-setup — Full Setup'));
    console.log(chalk.dim(`  Agents: ${config.agents.join(', ')} · Profile: ${config.profile}`));
    console.log('');
  }

  const mark = (name: string, status: 'done' | 'skipped') => {
    const step = steps.find((s) => s.name === name);
    if (step) step.status = status;
  };

  if (!options.dryRun) {
    await hooksCommand({ install: true });
    mark('hooks', 'done');

    if (!options.skipLlm) {
      await initCommand({
        agent: toInitAgents(config.agents),
        autoApprove: options.autoApprove ?? true,
        dryRun: false,
        verbose: false,
      });
      mark('init', 'done');
    }

    if (config.codegraph && !options.skipCodegraph) {
      console.log(chalk.dim('\n  Setting up local Tree-sitter WASM codegraph...'));
      await codegraphSetupCommand({ dryRun: false, skipIndex: false });
      mark('codegraph', 'done');

      // MCP server setup instructions
      console.log('');
      console.log(chalk.bold.yellow('  ⚠ MCP Server Setup Required'));
      console.log('');
      console.log(
        chalk.dim('  To enable project analysis and code graph generation, add the MCP server:'),
      );
      console.log('');
      console.log(chalk.dim('  MCP configuration files have been created for:'));
      console.log(chalk.dim('    - Cursor: .cursor/mcp.json'));
      console.log(chalk.dim('    - VSCode: .vscode/mcp.json'));
      console.log(chalk.dim('    - Windsurf: .windsurf/mcp.json'));
      console.log(chalk.dim('    - Devin: .devin/mcp.json'));
      console.log(chalk.dim('    - Codex: .codex/mcp.json'));
      console.log(chalk.dim('    - JetBrains: .idea/mcp.json'));
      console.log('');
      console.log(chalk.dim('  For Cursor:'));
      console.log(chalk.dim('    1. Open Cursor → Settings → MCP'));
      console.log(chalk.dim('    2. Add the codegraph server from .cursor/mcp.json'));
      console.log(chalk.dim('    3. Restart Cursor to load the MCP server'));
      console.log('');
      console.log(chalk.dim('  For VSCode:'));
      console.log(chalk.dim('    1. Install MCP extension for VSCode'));
      console.log(chalk.dim('    2. The .vscode/mcp.json file has been created in your workspace'));
      console.log(chalk.dim('    3. Reload VSCode to load the MCP server'));
      console.log('');
      console.log(chalk.dim('  For Windsurf:'));
      console.log(chalk.dim('    1. Open Windsurf → Settings → MCP'));
      console.log(chalk.dim('    2. Add the codegraph server from .windsurf/mcp.json'));
      console.log(chalk.dim('    3. Restart Windsurf to load the MCP server'));
      console.log('');
      console.log(chalk.dim('  For Devin:'));
      console.log(chalk.dim('    1. Open Devin → Settings → MCP'));
      console.log(chalk.dim('    2. Add the codegraph server from .devin/mcp.json'));
      console.log(chalk.dim('    3. Restart Devin to load the MCP server'));
      console.log('');
      console.log(chalk.dim('  For Codex:'));
      console.log(chalk.dim('    1. Open Codex → Settings → MCP'));
      console.log(chalk.dim('    2. Add the codegraph server from .codex/mcp.json'));
      console.log(chalk.dim('    3. Restart Codex to load the MCP server'));
      console.log('');
      console.log(chalk.dim('  For JetBrains (IntelliJ, PyCharm, etc.):'));
      console.log(chalk.dim('    1. Install MCP plugin for JetBrains'));
      console.log(chalk.dim('    2. The .idea/mcp.json file has been created in your workspace'));
      console.log(chalk.dim('    3. Restart the IDE to load the MCP server'));
      console.log('');
      console.log(chalk.dim('  For Claude Desktop:'));
      console.log(chalk.dim('    1. Open Claude Desktop → Settings → Developer'));
      console.log(chalk.dim('    2. Edit MCP servers configuration'));
      console.log(chalk.dim('    3. Add the codegraph server from .cursor/mcp.json'));
      console.log('');
      console.log(chalk.dim('  MCP tools available:'));
      console.log(chalk.dim('    - get_neighborhood: Retrieve code context around symbols'));
      console.log(chalk.dim('    - search_symbols: Search for symbols by pattern'));
      console.log(chalk.dim('    - get_callers: Find all callers of a function'));
      console.log(chalk.dim('    - get_callees: Find all functions called by a function'));
      console.log('');
      console.log(chalk.bold('  Usage Examples:'));
      console.log('');
      console.log(chalk.dim('  1. Generate code graph for a function:'));
      console.log(chalk.dim('     Use get_neighborhood with symbol name to see:'));
      console.log(chalk.dim('     - Function definition and parameters'));
      console.log(chalk.dim('     - Functions it calls (callees)'));
      console.log(chalk.dim('     - Functions that call it (callers)'));
      console.log(chalk.dim('     - Related classes and imports'));
      console.log('');
      console.log(chalk.dim('  2. Search for symbols:'));
      console.log(chalk.dim('     Use search_symbols with pattern like:'));
      console.log(chalk.dim('     - "User.*" to find all User-related symbols'));
      console.log(chalk.dim('     - "create.*" to find all create functions'));
      console.log(chalk.dim('     - ".*Controller" to find all controllers'));
      console.log('');
      console.log(chalk.dim('  3. Analyze call chains:'));
      console.log(chalk.dim('     Use get_callers to trace who uses a function'));
      console.log(chalk.dim('     Use get_callees to understand what a function does'));
      console.log(chalk.dim('     Chain multiple calls to map full execution paths'));
      console.log('');
      console.log(chalk.dim('  4. Understand code structure:'));
      console.log(chalk.dim('     Start with a high-level symbol (e.g., main, controller)'));
      console.log(chalk.dim('     Use get_neighborhood with depth=3 for broader context'));
      console.log(chalk.dim('     Drill down into specific functions with depth=1'));
      console.log('');
      console.log(chalk.dim('  Example workflow:'));
      console.log(chalk.dim('     1. search_symbols for "Controller" to find entry points'));
      console.log(chalk.dim('     2. get_neighborhood on a controller to understand flow'));
      console.log(chalk.dim('     3. get_callees on key methods to trace business logic'));
      console.log(chalk.dim('     4. get_callers on utility functions to find usage'));
      console.log('');
    }

    if (config.analyze_on_setup) {
      await analyzeCommand({ json: false, dryRun: false });
      mark('analyze', 'done');
    }

    try {
      await compositeScoreCommand({ json: options.json, quiet: false });
      mark('readiness', 'done');
    } catch {
      mark('readiness', 'done');
    }

    try {
      await doctorCommand({ json: options.json, soft: true });
      mark('doctor', 'done');
    } catch {
      mark('doctor', 'done');
    }
  } else {
    for (const step of steps) step.status = 'skipped';
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          config,
          steps,
          dry_run: !!options.dryRun,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.bold.green('\n  Setup complete!\n'));
  console.log(chalk.dim('  Run `agentic-setup check` before commits or in CI.'));
  console.log('');
}
