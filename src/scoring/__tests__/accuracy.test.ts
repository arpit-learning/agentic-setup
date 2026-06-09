import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkAccuracy } from '../checks/accuracy.js';

describe('checkAccuracy', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agentic-accuracy-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('validates that referenced paths exist on disk', () => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), '');
    writeFileSync(join(dir, 'src', 'utils.ts'), '');

    writeFileSync(join(dir, 'CLAUDE.md'), 'Key files:\n- `src/index.ts`\n- `src/utils.ts`');

    const checks = checkAccuracy(dir);
    const refCheck = checks.find((c) => c.id === 'references_valid');
    expect(refCheck?.earnedPoints).toBeGreaterThan(0);
    expect(refCheck?.passed).toBe(true);
  });

  it('detects invalid path references', () => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), '');

    writeFileSync(
      join(dir, 'CLAUDE.md'),
      'Key files:\n- `src/index.ts`\n- `src/missing.ts`\n- `src/gone/file.ts`',
    );

    const checks = checkAccuracy(dir);
    const refCheck = checks.find((c) => c.id === 'references_valid');
    expect(refCheck?.fix).toBeDefined();
    expect(refCheck?.fix?.data.invalid).toBeDefined();
    const invalid = refCheck?.fix?.data.invalid as string[];
    expect(invalid.some((p) => p.includes('missing') || p.includes('gone'))).toBe(true);
  });

  it('scores 0 when no references exist (not full points)', () => {
    writeFileSync(join(dir, 'CLAUDE.md'), '# Project\n\nJust some text without any paths.');

    const checks = checkAccuracy(dir);
    const refCheck = checks.find((c) => c.id === 'references_valid');
    expect(refCheck?.passed).toBe(false);
    expect(refCheck?.earnedPoints).toBe(0);
  });

  it('skips URLs and glob patterns', () => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'main.ts'), '');

    writeFileSync(
      join(dir, 'CLAUDE.md'),
      'See https://example.com/docs for more.\nEntry: `src/main.ts`\nPattern: `*.test.ts`',
    );

    const checks = checkAccuracy(dir);
    const refCheck = checks.find((c) => c.id === 'references_valid');
    // Only src/main.ts should be validated, URL and glob should be skipped
    expect(refCheck?.detail).toContain('1/1');
  });

  it('handles missing CLAUDE.md gracefully', () => {
    const checks = checkAccuracy(dir);
    const refCheck = checks.find((c) => c.id === 'references_valid');
    expect(refCheck).toBeDefined();
    expect(refCheck?.earnedPoints).toBe(0);
  });
});
