import { describe, it, expect } from 'vitest';
import { computeCompositeScore } from '../composite-score.js';
import type { ScoreResult } from '../../scoring/index.js';

function mockConfigScore(score: number): ScoreResult {
  return {
    score,
    maxScore: 100,
    grade: 'B',
    checks: [],
    categories: {
      existence: { earned: 20, max: 25 },
      quality: { earned: 20, max: 25 },
      grounding: { earned: 15, max: 20 },
      accuracy: { earned: 10, max: 15 },
      freshness: { earned: 8, max: 10 },
      bonus: { earned: 3, max: 5 },
    },
    targetAgent: ['cursor'],
    timestamp: new Date().toISOString(),
  };
}

describe('computeCompositeScore', () => {
  it('combines agentic-setup and extension scores', () => {
    const result = computeCompositeScore(
      mockConfigScore(80),
      { indexed: true, index_age_days: 1 },
      {
        lint: { ran: true, ok: true, summary: 'clean' },
        security: { ran: false, ok: true, summary: '' },
        tests: { source_count: 10, test_count: 2, ratio: 0.2 },
        ci_present: true,
      },
    );
    expect(result.config_score).toBe(80);
    expect(result.extension_score).toBeGreaterThan(15);
    expect(result.combined_percentage).toBeGreaterThan(70);
  });

  it('penalizes missing codegraph index', () => {
    const withIndex = computeCompositeScore(
      mockConfigScore(70),
      { indexed: true },
      {
        lint: { ran: false, ok: true, summary: '' },
        security: { ran: false, ok: true, summary: '' },
        tests: { source_count: 0, test_count: 0, ratio: 0 },
        ci_present: false,
      },
    );
    const withoutIndex = computeCompositeScore(
      mockConfigScore(70),
      { indexed: false },
      {
        lint: { ran: false, ok: true, summary: '' },
        security: { ran: false, ok: true, summary: '' },
        tests: { source_count: 0, test_count: 0, ratio: 0 },
        ci_present: false,
      },
    );
    expect(withIndex.extension_score).toBeGreaterThan(withoutIndex.extension_score);
  });
});
