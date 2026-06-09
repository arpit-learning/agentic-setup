import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const CHECKS_DIR = join(REPO_ROOT, 'src', 'scoring', 'checks');
const SCORING_DOC = join(REPO_ROOT, 'docs', 'SCORING.md');

function collectCheckIdsFromSource(): string[] {
  const ids = new Set<string>();
  for (const file of readdirSync(CHECKS_DIR).filter((f) => f.endsWith('.ts'))) {
    const content = readFileSync(join(CHECKS_DIR, file), 'utf-8');
    for (const match of content.matchAll(/id:\s*'([a-z_]+)'/g)) {
      ids.add(match[1]);
    }
  }
  return [...ids].sort();
}

describe('docs/SCORING.md rubric sync', () => {
  const doc = readFileSync(SCORING_DOC, 'utf-8');
  const checkIds = collectCheckIdsFromSource();

  it('documents every check id from scoring source', () => {
    const missing = checkIds.filter((id) => !doc.includes(`\`${id}\``));
    expect(missing, `Missing from SCORING.md: ${missing.join(', ')}`).toEqual([]);
  });

  it('uses correct dismissed-checks filename', () => {
    expect(doc).toContain('.agentic-setup/dismissed-checks.json');
    expect(doc).not.toContain('dismissed.json');
  });

  it('documents MCP optional behavior', () => {
    expect(doc).toMatch(/mcp_servers.*maxPoints.*0/is);
  });

  it('documents readiness grade alignment with config score', () => {
    expect(doc).toMatch(/same grade thresholds/i);
    expect(doc).toMatch(/readiness.*70%/i);
  });
});
