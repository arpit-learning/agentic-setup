import chalk from 'chalk';
import { computeLocalScore } from '../scoring/index.js';
import { displayScore } from '../scoring/display.js';
import { getCodegraphStats } from '../extensions/codegraph.js';
import { runStaticScans } from '../extensions/static-scans.js';
import { computeCompositeScore } from '../extensions/composite-score.js';

interface CompositeScoreOptions {
  json?: boolean;
  quiet?: boolean;
}

export async function compositeScoreCommand(options: CompositeScoreOptions = {}): Promise<void> {
  const dir = process.cwd();
  const configScore = computeLocalScore(dir);
  const codegraph = getCodegraphStats(dir);
  const scans = runStaticScans(dir, { skipLint: true, skipSecurity: true });
  const composite = computeCompositeScore(configScore, codegraph, scans);

  if (options.json) {
    console.log(JSON.stringify(composite, null, 2));
    return;
  }

  if (options.quiet) {
    console.log(`${composite.combined_percentage}`);
    return;
  }

  displayScore(configScore);
  console.log('');
  console.log(chalk.bold.cyan('  Extended Readiness (Codegraph + Analysis)'));
  console.log(
    chalk.bold(
      `  Combined: ${composite.combined_percentage}% (${composite.combined_grade}) — extension ${composite.extension_score}/${composite.extension_max}`,
    ),
  );
  if (composite.extension_findings.length) {
    console.log(chalk.dim('  ' + composite.extension_findings.join(' · ')));
  }
  if (composite.extension_actions.length) {
    console.log('');
    console.log('  Top actions:');
    composite.extension_actions.forEach((a, i) => console.log(chalk.dim(`    ${i + 1}. ${a}`)));
  }
  console.log('');
}
