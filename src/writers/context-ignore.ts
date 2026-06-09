import fs from 'fs';
import path from 'path';
import { getExcludePatterns } from '../extensions/codegraph.js';
import { getAllIgnorePatterns } from '../lib/project-config.js';

const MANAGED_MARKER = '# agentic-setup: context boundaries';

const DEFAULT_CURSOR_IGNORE = [
  'node_modules/',
  'dist/',
  'build/',
  'target/',
  '.git/',
  '.agentic-setup/',
  '.codegraph/',
  'codegraph.db',
  '*.log',
  '.env',
  '.env.*',
];

export function buildIgnoreContent(repoRoot: string): string {
  const extra = getAllIgnorePatterns(repoRoot);
  const lines = [
    MANAGED_MARKER,
    ...new Set([...DEFAULT_CURSOR_IGNORE, ...getExcludePatterns(), ...extra]),
  ];
  return lines.join('\n') + '\n';
}

export function writeContextIgnoreFiles(
  repoRoot: string,
  options: { dryRun?: boolean } = {},
): string[] {
  const content = buildIgnoreContent(repoRoot);
  const written: string[] = [];
  for (const rel of ['.cursorignore', '.agentic-setupignore']) {
    const file = path.join(repoRoot, rel);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    if (existing.includes(MANAGED_MARKER)) continue;
    if (!options.dryRun) {
      const merged = existing.trim() ? `${existing.trimEnd()}\n\n${content}` : content;
      fs.writeFileSync(file, merged);
    }
    written.push(rel);
  }
  return written;
}
