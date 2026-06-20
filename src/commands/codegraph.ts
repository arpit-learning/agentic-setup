import chalk from 'chalk';
import ora from 'ora';
import {
  mergeCodegraphMcp,
  writeIndexScript,
  writeMcpServerScript,
  appendGitignoreEntries,
  runCodegraphIndex,
  getCodegraphStats,
  parseIndexOutput,
  checkCodegraphCli,
  codegraphServe,
} from '../extensions/codegraph.js';

interface CodegraphSetupOptions {
  dryRun?: boolean;
  skipIndex?: boolean;
}

export async function codegraphSetupCommand(options: CodegraphSetupOptions = {}): Promise<void> {
  const repoRoot = process.cwd();

  console.log('');
  console.log(chalk.bold.cyan('  agentic-setup — Codegraph Setup'));
  console.log('');
  console.log(chalk.dim('  Architecture: Tree-sitter + SCIP + Neo4j'));
  console.log('');

  // Check dependencies
  const depCheck = checkCodegraphCli(repoRoot);
  if (!depCheck.available && depCheck.missing) {
    console.log(chalk.yellow('  ⚠ Missing dependencies:'));
    for (const dep of depCheck.missing) {
      console.log(chalk.yellow(`    - ${dep}`));
    }
    console.log('');
    console.log(chalk.dim('  Install missing dependencies to enable full functionality.'));
    console.log('');
  }

  const mcpAdded = mergeCodegraphMcp(repoRoot, options.dryRun);
  const scriptPath = writeIndexScript(repoRoot, options.dryRun);
  const mcpServerPath = writeMcpServerScript(repoRoot, options.dryRun);
  appendGitignoreEntries(repoRoot, options.dryRun);

  if (mcpAdded) {
    console.log(chalk.green('  ✓ Added codegraph to .cursor/mcp.json'));
    console.log(chalk.green('  ✓ Added codegraph to .vscode/mcp.json'));
    console.log(chalk.green('  ✓ Added codegraph to .windsurf/mcp.json'));
    console.log(chalk.green('  ✓ Added codegraph to .devin/mcp.json'));
    console.log(chalk.green('  ✓ Added codegraph to .codex/mcp.json'));
    console.log(chalk.green('  ✓ Added codegraph to .idea/mcp.json'));
  } else {
    console.log(chalk.dim('  · Codegraph already in .cursor/mcp.json'));
    console.log(chalk.dim('  · Codegraph already in .vscode/mcp.json'));
    console.log(chalk.dim('  · Codegraph already in .windsurf/mcp.json'));
    console.log(chalk.dim('  · Codegraph already in .devin/mcp.json'));
    console.log(chalk.dim('  · Codegraph already in .codex/mcp.json'));
    console.log(chalk.dim('  · Codegraph already in .idea/mcp.json'));
  }
  console.log(chalk.green(`  ✓ Wrote ${scriptPath}`));
  console.log(chalk.green(`  ✓ Wrote ${mcpServerPath}`));

  if (!options.skipIndex && !options.dryRun) {
    const spinner = ora('Indexing repository...').start();
    spinner.text = 'Parsing with Tree-sitter...';
    const result = await runCodegraphIndex(repoRoot);
    const parsed = parseIndexOutput(result.output);
    const stats = { ...getCodegraphStats(repoRoot), ...parsed };
    if (result.ok) {
      const details = [];
      if (stats.symbol_count) details.push(`${stats.symbol_count} symbols`);
      if (stats.node_count) details.push(`${stats.node_count} nodes`);
      if (stats.edge_count) details.push(`${stats.edge_count} edges`);
      spinner.succeed(`Indexed${details.length > 0 ? ` (${details.join(', ')})` : ''}`);
    } else {
      spinner.warn('Index failed — run agentic-setup codegraph setup manually');
      console.log(chalk.dim(`  Error: ${result.output}`));
    }
  }

  console.log('');
  console.log(chalk.bold('  Next steps:'));
  console.log(chalk.dim('  1. Start Neo4j: docker run -p 7474:7474 -p 7687:7687 neo4j'));
  console.log(
    chalk.dim('  2. Open Cursor/VSCode → Settings → MCP to verify codegraph is running.'),
  );
  console.log('');
  console.log(chalk.bold('  MCP tools available:'));
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

export async function codegraphIndexCommand(): Promise<void> {
  const repoRoot = process.cwd();
  const result = await runCodegraphIndex(repoRoot);
  if (result.ok) {
    console.log(result.output);
  } else {
    console.error(`Error: ${result.output}`);
    throw new Error(result.output);
  }
}

export async function codegraphServeCommand(workspace: string): Promise<void> {
  const repoRoot = workspace || process.cwd();
  await codegraphServe(repoRoot);
}
