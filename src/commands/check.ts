import chalk from 'chalk';
import { readProjectConfig } from '../lib/project-config.js';
import { computeLocalScore } from '../scoring/index.js';
import { getCodegraphStats } from '../extensions/codegraph.js';
import { runStaticScans } from '../extensions/static-scans.js';
import { computeCompositeScore } from '../extensions/composite-score.js';
import { collectDoctorChecks, type DoctorCheck } from './doctor.js';

export interface CheckOptions {
  json?: boolean;
  quiet?: boolean;
}

export interface CheckResult {
  passed: boolean;
  config_score: number;
  combined_percentage: number;
  readiness_threshold: number;
  config_score_threshold: number;
  critical_failures: string[];
  warnings: string[];
  checks: DoctorCheck[];
}

export async function checkCommand(options: CheckOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  const config = readProjectConfig(repoRoot);
  const doctorChecks = collectDoctorChecks(repoRoot);
  const configScore = computeLocalScore(repoRoot, config.agents);
  const codegraph = getCodegraphStats(repoRoot);
  const scans = runStaticScans(repoRoot, { skipLint: true, skipSecurity: true });
  const composite = computeCompositeScore(configScore, codegraph, scans);

  const criticalFailures = doctorChecks.filter((c) => c.critical && !c.ok).map((c) => c.label);
  const warnings = doctorChecks.filter((c) => !c.critical && !c.ok).map((c) => c.label);

  const scoreOk = configScore.score >= config.config_score_threshold;
  const readinessOk = composite.combined_percentage >= config.readiness_threshold;

  if (!scoreOk) {
    criticalFailures.push(
      `Config score ${configScore.score} below threshold ${config.config_score_threshold}`,
    );
  }
  if (!readinessOk) {
    criticalFailures.push(
      `Readiness ${composite.combined_percentage}% below threshold ${config.readiness_threshold}%`,
    );
  }

  const result: CheckResult = {
    passed: criticalFailures.length === 0,
    config_score: configScore.score,
    combined_percentage: composite.combined_percentage,
    readiness_threshold: config.readiness_threshold,
    config_score_threshold: config.config_score_threshold,
    critical_failures: criticalFailures,
    warnings,
    checks: doctorChecks,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (options.quiet) {
    console.log(result.passed ? '0' : '1');
  } else {
    console.log('');
    console.log(chalk.bold.cyan('  agentic-setup — Check'));
    console.log('');
    console.log(
      `  Config score: ${configScore.score}/100 (threshold ${config.config_score_threshold})`,
    );
    console.log(
      `  Readiness: ${composite.combined_percentage}% (threshold ${config.readiness_threshold}%)`,
    );
    console.log('');
    for (const c of doctorChecks) {
      if (c.ok) console.log(chalk.green(`  ✓ ${c.label}`));
      else if (c.critical) console.log(chalk.red(`  ✗ ${c.label}${c.hint ? ` — ${c.hint}` : ''}`));
      else console.log(chalk.yellow(`  ! ${c.label}${c.hint ? ` — ${c.hint}` : ''}`));
    }
    console.log('');
    if (result.passed) console.log(chalk.green.bold('  PASSED'));
    else {
      console.log(chalk.red.bold('  FAILED'));
      for (const f of criticalFailures) console.log(chalk.red(`    • ${f}`));
    }
    console.log('');
  }

  if (!result.passed) {
    process.exitCode = 1;
  }
}
