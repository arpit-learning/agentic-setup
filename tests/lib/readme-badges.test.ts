import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  README_BADGES_END,
  README_BADGES_START,
  buildReadmeBadgeBlock,
  buildReadmeBadgeLines,
  collectReadmeBadgeOptions,
  patchReadmeBadges,
  scoreBadgeColor,
} from '../../src/lib/readme-badges.js';
import { SUPPORTED_TARGET_AGENTS } from '../../src/constants.js';

describe('readme-badges', () => {
  it('maps score thresholds to shield colors', () => {
    expect(scoreBadgeColor(95)).toBe('brightgreen');
    expect(scoreBadgeColor(90)).toBe('brightgreen');
    expect(scoreBadgeColor(89)).toBe('green');
    expect(scoreBadgeColor(70)).toBe('green');
    expect(scoreBadgeColor(69)).toBe('yellow');
    expect(scoreBadgeColor(40)).toBe('yellow');
    expect(scoreBadgeColor(39)).toBe('red');
  });

  it('emits one supported-agent badge per configured agent', () => {
    const lines = buildReadmeBadgeLines({
      repoSlug: 'arpit-pm1/agentic-setup',
      repoUrl: 'https://github.com/arpit-pm1/agentic-setup',
      license: 'MIT',
      nodeEngine: '>=20.19',
      score: 88,
    });
    const agentBadges = lines.filter((line) => line.includes('-supported-blue'));
    expect(agentBadges).toHaveLength(SUPPORTED_TARGET_AGENTS.length);
    expect(lines.some((line) => line.includes('config-88%2F100-green'))).toBe(true);
    expect(lines.some((line) => line.includes('workflows/ci.yml/badge.svg'))).toBe(true);
  });

  it('replaces content between README markers', () => {
    const input = `# Title

<p align="center">
${README_BADGES_START}
old badge
${README_BADGES_END}
</p>
`;
    const output = patchReadmeBadges(input, '  <img src="new">');
    expect(output).toContain(`${README_BADGES_START}\n  <img src="new">\n${README_BADGES_END}`);
    expect(output).not.toContain('old badge');
  });

  it('collects live score options for this repo', () => {
    const options = collectReadmeBadgeOptions(process.cwd());
    expect(options.repoSlug).toBe('arpit-pm1/agentic-setup');
    expect(options.license).toBe('MIT');
    expect(options.nodeEngine).toBe('>=20.19');
    expect(options.score).toBeGreaterThan(0);
    expect(options.score).toBeLessThanOrEqual(100);
    expect(buildReadmeBadgeBlock(options)).toContain('config-');
  });

  it('round-trips marker replacement on a temp README', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-badges-'));
    const readmePath = path.join(tmpDir, 'README.md');
    fs.writeFileSync(
      readmePath,
      `<p align="center">\n${README_BADGES_START}\n${README_BADGES_END}\n</p>\n`,
    );
    fs.copyFileSync(path.join(process.cwd(), 'package.json'), path.join(tmpDir, 'package.json'));
    fs.mkdirSync(path.join(tmpDir, '.agentic-setup'), { recursive: true });

    const options = collectReadmeBadgeOptions(tmpDir);
    const updated = patchReadmeBadges(fs.readFileSync(readmePath, 'utf-8'), buildReadmeBadgeBlock(options));
    fs.writeFileSync(readmePath, updated);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('github/v/release/arpit-pm1/agentic-setup');
    expect(content.match(/-supported-blue/g)?.length).toBe(SUPPORTED_TARGET_AGENTS.length);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
