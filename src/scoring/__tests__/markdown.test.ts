import { describe, it, expect } from 'vitest';
import type { ScoreResult, Check } from '../index.js';
import { formatScoreCommentMarkdown, SCORE_COMMENT_MARKER } from '../markdown.js';

function makeCheck(overrides: Partial<Check> & Pick<Check, 'id' | 'name' | 'category'>): Check {
  return {
    maxPoints: 10,
    earnedPoints: 0,
    passed: false,
    detail: '',
    ...overrides,
  };
}

function makeResult(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    score: 72,
    maxScore: 100,
    grade: 'B',
    checks: [],
    categories: {
      existence: { earned: 10, max: 25 },
      quality: { earned: 20, max: 25 },
      grounding: { earned: 12, max: 20 },
      accuracy: { earned: 8, max: 15 },
      freshness: { earned: 6, max: 10 },
      bonus: { earned: 4, max: 9 },
    },
    targetAgent: ['claude', 'cursor'],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('formatScoreCommentMarkdown', () => {
  it('includes marker, score header, and category breakdown', () => {
    const body = formatScoreCommentMarkdown(makeResult());

    expect(body).toContain(SCORE_COMMENT_MARKER);
    expect(body).toContain('72/100 (B)');
    expect(body).toContain('### Category Breakdown');
    expect(body).toContain('| Files & Setup | 10 | 25 | -15 |');
    expect(body).toContain('Full scoring rubric');
  });

  it('shows delta when compare options provided', () => {
    const body = formatScoreCommentMarkdown(makeResult(), {
      base: { score: 60, grade: 'C', ref: 'staging' },
      delta: 12,
    });

    expect(body).toContain('**+12**');
    expect(body).toContain('`staging`');
    expect(body).toContain('(60/100)');
  });

  it('separates partial credit from failing checks', () => {
    const checks: Check[] = [
      makeCheck({
        id: 'refs',
        name: 'References valid',
        category: 'accuracy',
        maxPoints: 8,
        earnedPoints: 4,
        passed: false,
        detail: '4/8 paths valid',
        suggestion: 'Fix broken paths',
      }),
      makeCheck({
        id: 'mcp',
        name: 'MCP servers',
        category: 'existence',
        maxPoints: 3,
        earnedPoints: 0,
        passed: false,
        suggestion: 'Add MCP config',
      }),
      makeCheck({
        id: 'claude',
        name: 'CLAUDE.md exists',
        category: 'existence',
        maxPoints: 6,
        earnedPoints: 6,
        passed: true,
      }),
    ];

    const body = formatScoreCommentMarkdown(makeResult({ checks }));

    expect(body).toContain('### Partial Credit');
    expect(body).toContain('References valid');
    expect(body).toContain('4/8');
    expect(body).toContain('### Failing Checks');
    expect(body).toContain('MCP servers');
    expect(body).toContain('passing checks');
    expect(body).toContain('CLAUDE.md exists');
  });

  it('lists top improvements sorted by potential gain', () => {
    const checks: Check[] = [
      makeCheck({
        id: 'a',
        name: 'Small gap',
        category: 'bonus',
        maxPoints: 2,
        earnedPoints: 0,
        suggestion: 'Fix A',
      }),
      makeCheck({
        id: 'b',
        name: 'Big gap',
        category: 'quality',
        maxPoints: 8,
        earnedPoints: 0,
        suggestion: 'Fix B',
      }),
    ];

    const body = formatScoreCommentMarkdown(makeResult({ checks }));

    expect(body).toContain('### Top Improvements');
    expect(body.indexOf('Big gap')).toBeLessThan(body.indexOf('Small gap'));
  });

  it('includes readiness section when provided', () => {
    const body = formatScoreCommentMarkdown(makeResult(), {
      readiness: {
        config_score: 72,
        config_grade: 'B',
        extension_score: 18,
        extension_max: 30,
        combined_percentage: 68.4,
        combined_grade: 'C',
        codegraph: { indexed: true, index_age_days: 2 },
        static_scans: {
          lint: { ran: true, ok: true, summary: 'clean' },
          security: { ran: false, ok: false, summary: 'skipped' },
          tests: { ratio: 0.1, test_count: 5, source_count: 50 },
          ci_present: true,
        },
        extension_findings: ['Codegraph index exists'],
        extension_actions: ['Add tests to improve readiness'],
      },
    });

    expect(body).toContain('### Readiness (70% config + 30% extensions)');
    expect(body).toContain('68.4% (C)');
    expect(body).toContain('Codegraph index exists');
    expect(body).toContain('Add tests to improve readiness');
  });

  it('shows category delta table when baseResult differs', () => {
    const current = makeResult({
      categories: {
        existence: { earned: 15, max: 25 },
        quality: { earned: 20, max: 25 },
        grounding: { earned: 12, max: 20 },
        accuracy: { earned: 8, max: 15 },
        freshness: { earned: 6, max: 10 },
        bonus: { earned: 4, max: 9 },
      },
    });
    const base = makeResult({
      score: 60,
      grade: 'C',
      categories: {
        existence: { earned: 10, max: 25 },
        quality: { earned: 20, max: 25 },
        grounding: { earned: 12, max: 20 },
        accuracy: { earned: 8, max: 15 },
        freshness: { earned: 6, max: 10 },
        bonus: { earned: 4, max: 9 },
      },
    });

    const body = formatScoreCommentMarkdown(current, {
      base: { score: 60, grade: 'C', ref: 'main' },
      baseResult: base,
      delta: 12,
    });

    expect(body).toContain('### Category Changes vs Base');
    expect(body).toContain('| Files & Setup | 10/25 | 15/25 | +5 |');
  });
});
