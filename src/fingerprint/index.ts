import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getGitRemoteUrl } from './git.js';
import { getFileTree } from './file-tree.js';
import { readExistingConfigs } from './existing-config.js';
import { analyzeCode, CodeAnalysis } from './code-analysis.js';
import { detectProjectStack } from '../ai/detect.js';
import { loadConfig, getFastModel } from '../llm/config.js';
import { loadFingerprintCache, saveFingerprintCache } from './cache.js';
import {
  collectProjectContext,
  detectStackProgrammatically,
  type ProjectContext,
} from './project-context.js';

export type { CodeAnalysis };

export type { SourceSummary } from './sources.js';

export interface Fingerprint {
  gitRemoteUrl?: string;
  packageName?: string;
  languages: string[];
  frameworks: string[];
  tools: string[];
  fileTree: string[];
  existingConfigs: ReturnType<typeof readExistingConfigs>;
  codeAnalysis?: CodeAnalysis;
  description?: string;
  sources?: import('./sources.js').SourceSummary[];
  projectContext?: ProjectContext;
}

export async function collectFingerprint(dir: string): Promise<Fingerprint> {
  const gitRemoteUrl = getGitRemoteUrl(dir);
  const fileTree = getFileTree(dir);
  const existingConfigs = readExistingConfigs(dir);
  const packageName = readPackageName(dir);
  const projectContext = collectProjectContext(dir, fileTree);

  const cached = loadFingerprintCache(dir, fileTree);
  if (cached) {
    return {
      gitRemoteUrl,
      packageName,
      languages: cached.languages,
      frameworks: cached.frameworks,
      tools: cached.tools,
      fileTree,
      existingConfigs,
      codeAnalysis: cached.codeAnalysis,
      projectContext: cached.projectContext || projectContext,
    };
  }

  const codeAnalysis = analyzeCode(dir);
  const fingerprint: Fingerprint = {
    gitRemoteUrl,
    packageName,
    languages: [],
    frameworks: [],
    tools: [],
    fileTree,
    existingConfigs,
    codeAnalysis,
    projectContext,
  };

  const workspaces = await enrichWithLLM(dir, fingerprint);

  saveFingerprintCache(
    dir,
    fileTree,
    codeAnalysis,
    fingerprint.languages,
    fingerprint.frameworks,
    fingerprint.tools,
    workspaces,
    projectContext,
  );

  return fingerprint;
}

export function readPackageName(dir: string): string | undefined {
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return undefined;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.name;
  } catch {
    return undefined;
  }
}

export function computeFingerprintHash(fingerprint: Fingerprint): string {
  const key = [fingerprint.gitRemoteUrl || '', fingerprint.packageName || ''].join('::');

  return crypto.createHash('sha256').update(key).digest('hex');
}

async function enrichWithLLM(dir: string, fingerprint: Fingerprint): Promise<string[]> {
  // 1. Programmatic detection first
  const programmatic = detectStackProgrammatically(dir, fingerprint.fileTree);

  // Set initial programmatic values
  fingerprint.languages = programmatic.languages;
  fingerprint.frameworks = programmatic.frameworks;
  fingerprint.tools = programmatic.tools;

  try {
    const config = loadConfig();
    if (!config) return [];
    if (fingerprint.fileTree.length === 0) return [];

    const suffixCounts: Record<string, number> = {};
    for (const entry of fingerprint.fileTree) {
      if (entry.endsWith('/')) continue;
      const ext = path.extname(entry).toLowerCase();
      if (ext) {
        suffixCounts[ext] = (suffixCounts[ext] || 0) + 1;
      }
    }

    let result: Awaited<ReturnType<typeof detectProjectStack>>;
    try {
      result = await detectProjectStack(
        fingerprint.fileTree,
        suffixCounts,
        undefined,
        programmatic,
      );
    } catch (firstErr) {
      const fast = getFastModel();
      if (config.provider === 'cursor' && fast && fast !== 'auto') {
        result = await detectProjectStack(fingerprint.fileTree, suffixCounts, 'auto', programmatic);
      } else {
        throw firstErr;
      }
    }

    // 2. Merge (union) the programmatic and LLM detections
    const languages = new Set([...programmatic.languages, ...(result.languages || [])]);
    const frameworks = new Set([...programmatic.frameworks, ...(result.frameworks || [])]);
    const tools = new Set([...programmatic.tools, ...(result.tools || [])]);

    if (languages.size > 0) fingerprint.languages = Array.from(languages);
    if (frameworks.size > 0) fingerprint.frameworks = Array.from(frameworks);
    if (tools.size > 0) fingerprint.tools = Array.from(tools);

    return result.workspaces ?? [];
  } catch {
    // If LLM call fails completely, programmatic detection is already populated on fingerprint
    return [];
  }
}
