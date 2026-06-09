import type { ScoreResult } from '../scoring/index.js';
import { computeGrade } from '../scoring/constants.js';
import type { CodegraphStats } from './codegraph.js';
import type { StaticScanResult } from './static-scans.js';

export interface CompositeScore {
  config_score: number;
  config_grade: string;
  extension_score: number;
  extension_max: number;
  combined_percentage: number;
  combined_grade: string;
  codegraph: CodegraphStats;
  static_scans: StaticScanResult;
  extension_findings: string[];
  extension_actions: string[];
}

function gradeFromPct(pct: number): string {
  return computeGrade(Math.round(pct));
}

export function computeCompositeScore(
  configScore: ScoreResult,
  codegraph: CodegraphStats,
  scans: StaticScanResult,
): CompositeScore {
  const findings: string[] = [];
  const actions: string[] = [];
  let extScore = 0;
  const extMax = 30;

  if (codegraph.indexed) {
    extScore += 10;
    findings.push('Codegraph index exists');
    if (codegraph.index_age_days !== undefined && codegraph.index_age_days <= 7) {
      extScore += 5;
      findings.push(`Index fresh (${codegraph.index_age_days}d)`);
    } else if (codegraph.index_age_days !== undefined) {
      extScore += 2;
      actions.push(`Re-index Codegraph (stale ${codegraph.index_age_days}d)`);
    }
  } else {
    actions.push('Run: agentic-setup codegraph setup');
  }

  if (scans.lint.ran && scans.lint.ok) {
    extScore += 5;
    findings.push('Lint clean');
  } else if (scans.lint.ran) {
    extScore += 2;
    actions.push('Fix lint errors');
  } else {
    extScore += 2;
  }

  if (scans.security.ran && scans.security.ok) {
    extScore += 3;
    findings.push('Security scan clean');
  } else if (!scans.security.ran) {
    extScore += 1;
  }

  if (scans.tests.ratio >= 0.15) extScore += 5;
  else if (scans.tests.ratio >= 0.05) extScore += 3;
  else if (scans.tests.test_count > 0) extScore += 1;
  else actions.push('Add tests to improve readiness');

  const combinedPct =
    Math.round((configScore.score * 0.7 + (extScore / extMax) * 100 * 0.3) * 10) / 10;

  return {
    config_score: configScore.score,
    config_grade: configScore.grade,
    extension_score: extScore,
    extension_max: extMax,
    combined_percentage: combinedPct,
    combined_grade: gradeFromPct(combinedPct),
    codegraph,
    static_scans: scans,
    extension_findings: findings,
    extension_actions: actions,
  };
}
