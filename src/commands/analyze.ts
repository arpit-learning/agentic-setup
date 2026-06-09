import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getCodegraphStats, runCodegraphIndex, parseIndexOutput } from '../extensions/codegraph.js';
import { runStaticScans } from '../extensions/static-scans.js';

interface AnalyzeOptions {
  skipCodegraph?: boolean;
  skipLint?: boolean;
  skipSecurity?: boolean;
  reindex?: boolean;
  json?: boolean;
  dryRun?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions = {}): Promise<void> {
  const repoRoot = process.cwd();

  if (!options.json) {
    console.log('');
    console.log(chalk.bold.cyan('  agentic-setup — Analyze'));
    console.log(chalk.dim(`  Repository: ${repoRoot}`));
    console.log('');
  }

  let codegraphStats = getCodegraphStats(repoRoot);

  if (!options.skipCodegraph && (options.reindex || !codegraphStats.indexed)) {
    const spinner = ora('Indexing with Codegraph...').start();
    const result = runCodegraphIndex(repoRoot);
    const parsed = parseIndexOutput(result.output);
    codegraphStats = { ...getCodegraphStats(repoRoot), ...parsed };
    if (result.ok) spinner.succeed('Codegraph index complete');
    else spinner.warn('Codegraph index failed (continuing with other checks)');
  }

  const scanSpinner = ora('Running static scans...').start();
  const scans = runStaticScans(repoRoot, {
    skipLint: options.skipLint,
    skipSecurity: options.skipSecurity,
  });
  scanSpinner.succeed('Static scans complete');

  const report = {
    analyzed_at: new Date().toISOString(),
    repo_root: repoRoot,
    codegraph: codegraphStats,
    static_scans: scans,
  };

  const outPath = path.join(repoRoot, '.agentic-setup', 'analysis', 'latest.json');
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.green(`  ✓ Analysis saved to ${outPath}`));
  console.log(`  Codegraph: ${codegraphStats.indexed ? 'indexed' : 'not indexed'}`);
  console.log(
    `  Tests: ${scans.tests.test_count}/${scans.tests.source_count} (${(scans.tests.ratio * 100).toFixed(1)}%)`,
  );
  console.log(`  CI: ${scans.ci_present ? 'yes' : 'no'}`);
  console.log('');
}
