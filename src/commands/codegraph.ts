import chalk from 'chalk';
import ora from 'ora';
import {
  mergeCodegraphMcp,
  writeIndexScript,
  appendGitignoreEntries,
  runCodegraphIndex,
  getCodegraphStats,
  parseIndexOutput,
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

  const mcpAdded = mergeCodegraphMcp(repoRoot, options.dryRun);
  const scriptPath = writeIndexScript(repoRoot, options.dryRun);
  appendGitignoreEntries(repoRoot, options.dryRun);

  if (mcpAdded) console.log(chalk.green('  ✓ Added codegraph to .cursor/mcp.json'));
  else console.log(chalk.dim('  · Codegraph already in .cursor/mcp.json'));
  console.log(chalk.green(`  ✓ Wrote ${scriptPath}`));

  if (!options.skipIndex && !options.dryRun) {
    const spinner = ora('Indexing repository...').start();
    const result = runCodegraphIndex(repoRoot);
    const parsed = parseIndexOutput(result.output);
    const stats = { ...getCodegraphStats(repoRoot), ...parsed };
    if (result.ok) {
      spinner.succeed(`Indexed${stats.symbol_count ? ` (${stats.symbol_count} symbols)` : ''}`);
    } else {
      spinner.warn('Index failed — run agentic-setup codegraph setup manually');
    }
  }

  console.log('');
  console.log(chalk.dim('  Open Cursor → Settings → MCP to verify codegraph is running.'));
  console.log('');
}
