import fs from 'fs';
import path from 'path';
import {
  AGENT_DISPLAY_NAMES,
  GITHUB_REPO_SLUG,
  GITHUB_REPO_URL,
  SUPPORTED_TARGET_AGENTS,
} from '../constants.js';
import { computeLocalScore } from '../scoring/index.js';

export const README_BADGES_START = '<!-- readme-badges:start -->';
export const README_BADGES_END = '<!-- readme-badges:end -->';

export interface ReadmeBadgeOptions {
  repoSlug: string;
  repoUrl: string;
  license: string;
  nodeEngine: string;
  score: number;
}

export function scoreBadgeColor(score: number): string {
  if (score >= 90) return 'brightgreen';
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

function shieldsBadge(label: string, message: string, color: string): string {
  return `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}`;
}

function agentBadgeLabel(displayName: string): string {
  return displayName.replace(/ /g, '_');
}

export function buildReadmeBadgeLines(options: ReadmeBadgeOptions): string[] {
  const scoreColor = scoreBadgeColor(options.score);
  const lines = [
    `  <a href="${options.repoUrl}/releases"><img src="https://img.shields.io/github/v/release/${options.repoSlug}" alt="release version"></a>`,
    `  <a href="./LICENSE"><img src="${shieldsBadge('license', options.license, 'blue')}" alt="license"></a>`,
    `  <a href="https://nodejs.org"><img src="${shieldsBadge('node', options.nodeEngine, 'green')}" alt="node"></a>`,
    `  <a href="${options.repoUrl}/actions/workflows/ci.yml"><img src="https://github.com/${options.repoSlug}/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>`,
    `  <img src="${shieldsBadge('config', `${options.score}/100`, scoreColor)}" alt="agentic-setup Score">`,
  ];

  for (const agent of SUPPORTED_TARGET_AGENTS) {
    const displayName = AGENT_DISPLAY_NAMES[agent];
    lines.push(
      `  <img src="${shieldsBadge(agentBadgeLabel(displayName), 'supported', 'blue')}" alt="${displayName}">`,
    );
  }

  return lines;
}

export function buildReadmeBadgeBlock(options: ReadmeBadgeOptions): string {
  return buildReadmeBadgeLines(options).join('\n');
}

function readPackageBadgeOptions(repoRoot: string): Omit<ReadmeBadgeOptions, 'score'> {
  const pkgPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
    license?: string;
    engines?: { node?: string };
  };
  return {
    repoSlug: GITHUB_REPO_SLUG,
    repoUrl: GITHUB_REPO_URL,
    license: pkg.license ?? 'MIT',
    nodeEngine: pkg.engines?.node ?? '>=20',
  };
}

export function collectReadmeBadgeOptions(repoRoot: string): ReadmeBadgeOptions {
  const score = computeLocalScore(repoRoot).score;
  return { ...readPackageBadgeOptions(repoRoot), score };
}

export function patchReadmeBadges(content: string, badgeBlock: string): string {
  const startIdx = content.indexOf(README_BADGES_START);
  const endIdx = content.indexOf(README_BADGES_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`README must contain ${README_BADGES_START} and ${README_BADGES_END} markers`);
  }

  const before = content.slice(0, startIdx + README_BADGES_START.length);
  const after = content.slice(endIdx);
  return `${before}\n${badgeBlock}\n${after}`;
}

export function updateReadmeBadges(readmePath: string, repoRoot: string): string {
  const options = collectReadmeBadgeOptions(repoRoot);
  const badgeBlock = buildReadmeBadgeBlock(options);
  const content = fs.readFileSync(readmePath, 'utf-8');
  const updated = patchReadmeBadges(content, badgeBlock);
  fs.writeFileSync(readmePath, updated);
  return updated;
}
