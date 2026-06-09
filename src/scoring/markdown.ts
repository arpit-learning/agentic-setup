import type { ScoreResult, Check, CheckCategory } from './index.js';
import type { CompositeScore } from '../extensions/composite-score.js';
import { formatCheckPoints } from './display.js';
import { GRADE_THRESHOLDS } from './constants.js';

export const SCORE_COMMENT_MARKER = '<!-- agentic-score -->';

const CATEGORY_NAMES: Record<CheckCategory, string> = {
  existence: 'Files & Setup',
  quality: 'Quality',
  grounding: 'Grounding',
  accuracy: 'Accuracy',
  freshness: 'Freshness & Safety',
  bonus: 'Bonus',
};

const CATEGORY_ORDER: CheckCategory[] = [
  'existence',
  'quality',
  'grounding',
  'accuracy',
  'freshness',
  'bonus',
];

const GRADE_EMOJI: Record<string, string> = {
  A: '✅',
  B: '✅',
  C: '⚠️',
  D: '❌',
  F: '❌',
};

export interface ScoreCommentOptions {
  marker?: string;
  base?: { score: number; grade: string; ref?: string };
  baseResult?: ScoreResult;
  delta?: number;
  readiness?: CompositeScore;
  docsUrl?: string;
  agentLabel?: string;
}

function escapeCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function checkHint(check: Check): string {
  return check.suggestion || check.detail || '';
}

function formatAgentLabel(targetAgent: ScoreResult['targetAgent']): string {
  const names: Record<string, string> = {
    claude: 'Claude Code',
    cursor: 'Cursor',
    codex: 'Codex',
    opencode: 'OpenCode',
    'github-copilot': 'GitHub Copilot',
  };
  return targetAgent.map((a) => names[a] || a).join(' + ');
}

function formatCategoryBreakdown(result: ScoreResult): string[] {
  const lines = [
    '### Category Breakdown',
    '',
    '| Category | Earned | Max | Gap |',
    '|---|---:|---:|---:|',
  ];
  for (const category of CATEGORY_ORDER) {
    const summary = result.categories[category];
    if (summary.max === 0) continue;
    const gap = summary.max - summary.earned;
    lines.push(
      `| ${CATEGORY_NAMES[category]} | ${summary.earned} | ${summary.max} | ${gap > 0 ? `-${gap}` : '0'} |`,
    );
  }
  return lines;
}

function formatTopImprovements(checks: readonly Check[]): string[] {
  const improvable = checks
    .filter((c) => c.maxPoints > 0 && c.earnedPoints < c.maxPoints)
    .map((c) => ({
      name: c.name,
      potential: c.maxPoints - c.earnedPoints,
      suggestion: c.suggestion,
    }))
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 5);

  if (improvable.length === 0) return [];

  const lines = ['### Top Improvements', ''];
  for (let i = 0; i < improvable.length; i++) {
    const item = improvable[i];
    lines.push(`${i + 1}. **${item.name}** — +${item.potential} pts`);
    if (item.suggestion) lines.push(`   ${item.suggestion}`);
  }
  return lines;
}

function formatCategoryDeltaTable(current: ScoreResult, base: ScoreResult): string[] {
  const lines = [
    '### Category Changes vs Base',
    '',
    '| Category | Base | Current | Delta |',
    '|---|---:|---:|---:|',
  ];
  let hasChange = false;

  for (const category of CATEGORY_ORDER) {
    const cur = current.categories[category];
    const prev = base.categories[category];
    if (cur.max === 0 && prev.max === 0) continue;
    const delta = cur.earned - prev.earned;
    if (delta !== 0) hasChange = true;
    const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
    lines.push(
      `| ${CATEGORY_NAMES[category]} | ${prev.earned}/${prev.max} | ${cur.earned}/${cur.max} | ${deltaLabel} |`,
    );
  }

  return hasChange ? lines : [];
}

function formatReadinessSection(readiness: CompositeScore): string[] {
  const lines = [
    '### Readiness (70% config + 30% extensions)',
    '',
    '| Component | Score |',
    '|---|---|',
    `| Config | ${readiness.config_score}/100 (${readiness.config_grade}) |`,
    `| Extensions | ${readiness.extension_score}/${readiness.extension_max} |`,
    `| **Combined** | **${readiness.combined_percentage}% (${readiness.combined_grade})** |`,
    '',
  ];

  if (readiness.extension_findings.length > 0) {
    lines.push('Extension findings:', ...readiness.extension_findings.map((f) => `- ${f}`), '');
  }
  if (readiness.extension_actions.length > 0) {
    lines.push('Suggested actions:', ...readiness.extension_actions.map((a) => `- ${a}`), '');
  }

  return lines;
}

function formatCheckTable(title: string, checks: Check[], columns: 'full' | 'compact'): string[] {
  if (checks.length === 0) return [];

  const lines: string[] = [];
  if (title) {
    lines.push(title, '');
  }
  if (columns === 'full') {
    lines.push('| Check | Category | Points | Detail |', '|---|---|---|---|');
    for (const check of checks) {
      lines.push(
        `| ${escapeCell(check.name)} | ${CATEGORY_NAMES[check.category]} | ${formatCheckPoints(check)} | ${escapeCell(checkHint(check))} |`,
      );
    }
  } else {
    lines.push('| Check | Points |', '|---|---|');
    for (const check of checks) {
      lines.push(`| ${escapeCell(check.name)} | ${formatCheckPoints(check)} |`);
    }
  }
  return lines;
}

/** Markdown body for GitHub PR score comments (also used by `agentic-setup score --comment`). */
export function formatScoreCommentMarkdown(
  result: ScoreResult,
  options: ScoreCommentOptions = {},
): string {
  const marker = options.marker ?? SCORE_COMMENT_MARKER;
  const docsUrl =
    options.docsUrl ?? 'https://github.com/arpit-pm1/agentic-setup/blob/main/docs/SCORING.md';
  const emoji = GRADE_EMOJI[result.grade] ?? '❓';

  const lines: string[] = [
    marker,
    `## ${emoji} agentic-setup Score: ${result.score}/100 (${result.grade})`,
    '',
  ];

  if (options.base && options.delta !== undefined) {
    const sign = options.delta > 0 ? '+' : '';
    const icon = options.delta > 0 ? '⬆️' : options.delta < 0 ? '⬇️' : '➡️';
    const ref = options.base.ref ? `\`${options.base.ref}\`` : 'base branch';
    lines.push(`${icon} **${sign}${options.delta}** from ${ref} (${options.base.score}/100)`);
    lines.push('');
  }

  lines.push(`**Target:** ${options.agentLabel ?? formatAgentLabel(result.targetAgent)}`);
  lines.push('');
  lines.push(...formatCategoryBreakdown(result));
  lines.push('');

  if (options.baseResult) {
    const deltaLines = formatCategoryDeltaTable(result, options.baseResult);
    if (deltaLines.length > 0) {
      lines.push(...deltaLines, '');
    }
  }

  if (options.readiness) {
    lines.push(...formatReadinessSection(options.readiness), '');
  }

  const topImprovements = formatTopImprovements(result.checks);
  if (topImprovements.length > 0) {
    lines.push(...topImprovements, '');
  }

  const partial = result.checks.filter((c) => !c.passed && c.earnedPoints > 0 && c.maxPoints > 0);
  const failing = result.checks.filter((c) => !c.passed && c.earnedPoints <= 0 && c.maxPoints > 0);
  const passing = result.checks.filter((c) => c.passed && c.maxPoints > 0);

  if (partial.length > 0) {
    lines.push(...formatCheckTable('### Partial Credit', partial, 'full'), '');
  }

  if (failing.length > 0) {
    lines.push(...formatCheckTable('### Failing Checks', failing, 'full'), '');
  }

  if (passing.length > 0) {
    lines.push(`<details><summary>✅ ${passing.length} passing checks</summary>`, '');
    lines.push(...formatCheckTable('', passing, 'compact'));
    lines.push('</details>', '');
  }

  const gradeLine = GRADE_THRESHOLDS.map((g) => `${g.grade} ≥ ${g.minScore}`).join(' · ');
  lines.push(`<sub>Grades: ${gradeLine}. [Full scoring rubric](${docsUrl})</sub>`, '');
  lines.push('---');
  lines.push('*Powered by [agentic-setup](https://github.com/arpit-pm1/agentic-setup)*');

  return lines.join('\n');
}
