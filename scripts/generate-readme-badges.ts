import fs from 'fs';
import path from 'path';
import { patchReadmeBadges, collectReadmeBadgeOptions, buildReadmeBadgeBlock } from '../src/lib/readme-badges.js';

const repoRoot = process.cwd();
const readmePath = path.join(repoRoot, 'README.md');
const checkOnly = process.argv.includes('--check');

const options = collectReadmeBadgeOptions(repoRoot);
const badgeBlock = buildReadmeBadgeBlock(options);
const content = fs.readFileSync(readmePath, 'utf-8');
const updated = patchReadmeBadges(content, badgeBlock);

if (updated === content) {
  console.log('README badges are up to date.');
  process.exit(0);
}

if (checkOnly) {
  console.error('README badges are out of date. Run: npm run readme:badges');
  process.exit(1);
}

fs.writeFileSync(readmePath, updated);
console.log(`Updated README badges (config score: ${options.score}/100).`);
