import fs from 'fs';
import path from 'path';
import { AGENTIC_DIR, GITHUB_REPO_URL } from '../constants.js';

export type SetupProfile = 'auto' | 'api-only' | 'ui-feature' | 'java-service' | 'python-api';

export type TargetAgentName = 'claude' | 'cursor' | 'codex' | 'opencode' | 'github-copilot';

export interface ProjectConfig {
  version: 1;
  agents: TargetAgentName[];
  profile: SetupProfile;
  codegraph: boolean;
  analyze_on_setup: boolean;
  readiness_threshold: number;
  config_score_threshold: number;
  ignore: string[];
  run: { generate: boolean };
  ci: { workflow: boolean };
}

export const PROJECT_CONFIG_FILENAME = '.agentic-setup.yaml';
export const PROJECT_CONFIG_INTERNAL = path.join(AGENTIC_DIR, 'project.yaml');

const VALID_AGENTS = new Set<TargetAgentName>([
  'claude',
  'cursor',
  'codex',
  'opencode',
  'github-copilot',
]);

const VALID_PROFILES = new Set<SetupProfile>([
  'auto',
  'api-only',
  'ui-feature',
  'java-service',
  'python-api',
]);

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  version: 1,
  agents: ['claude', 'cursor'],
  profile: 'auto',
  codegraph: true,
  analyze_on_setup: true,
  readiness_threshold: 60,
  config_score_threshold: 60,
  ignore: [],
  run: { generate: true },
  ci: { workflow: false },
};

function normalizeAgents(raw: unknown): TargetAgentName[] {
  if (!Array.isArray(raw)) return DEFAULT_PROJECT_CONFIG.agents;
  const agents = raw
    .map((a) => String(a).trim().toLowerCase())
    .filter((a): a is TargetAgentName => VALID_AGENTS.has(a as TargetAgentName));
  return agents.length > 0 ? [...new Set(agents)] : DEFAULT_PROJECT_CONFIG.agents;
}

function parseYamlLike(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (currentKey && listItems.length > 0) {
      result[currentKey] = [...listItems];
      listItems = [];
    }
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch && currentKey) {
      listItems.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    flushList();
    const kv = trimmed.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim();

    if (!value) continue;

    if (value === 'true') result[currentKey] = true;
    else if (value === 'false') result[currentKey] = false;
    else if (/^\d+$/.test(value)) result[currentKey] = parseInt(value, 10);
    else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      result[currentKey] = inner
        ? inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
        : [];
    } else {
      result[currentKey] = value.replace(/^["']|["']$/g, '');
    }
  }
  flushList();
  return result;
}

function parseNestedBool(
  raw: Record<string, unknown>,
  section: string,
  key: string,
  fallback: boolean,
): boolean {
  const sec = raw[section];
  if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
    const v = (sec as Record<string, unknown>)[key];
    if (typeof v === 'boolean') return v;
  }
  return fallback;
}

export function mergeProjectConfig(partial: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    ...DEFAULT_PROJECT_CONFIG,
    ...partial,
    agents: partial.agents ?? DEFAULT_PROJECT_CONFIG.agents,
    ignore: partial.ignore ?? DEFAULT_PROJECT_CONFIG.ignore,
    run: { ...DEFAULT_PROJECT_CONFIG.run, ...partial.run },
    ci: { ...DEFAULT_PROJECT_CONFIG.ci, ...partial.ci },
  };
}

export function parseProjectConfig(content: string): ProjectConfig {
  const raw = parseYamlLike(content);
  const profile = String(raw.profile ?? 'auto').toLowerCase() as SetupProfile;
  return mergeProjectConfig({
    version: 1,
    agents: normalizeAgents(raw.agents),
    profile: VALID_PROFILES.has(profile) ? profile : 'auto',
    codegraph: raw.codegraph !== false,
    analyze_on_setup: raw.analyze_on_setup !== false,
    readiness_threshold: typeof raw.readiness_threshold === 'number' ? raw.readiness_threshold : 60,
    config_score_threshold:
      typeof raw.config_score_threshold === 'number' ? raw.config_score_threshold : 60,
    ignore: Array.isArray(raw.ignore)
      ? raw.ignore.map((i) => String(i))
      : DEFAULT_PROJECT_CONFIG.ignore,
    run: {
      generate: parseNestedBool(raw, 'run', 'generate', true),
    },
    ci: {
      workflow: parseNestedBool(raw, 'ci', 'workflow', false),
    },
  });
}

export function readProjectConfig(repoRoot: string = process.cwd()): ProjectConfig {
  const candidates = [
    path.join(repoRoot, PROJECT_CONFIG_FILENAME),
    path.join(repoRoot, PROJECT_CONFIG_INTERNAL),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return parseProjectConfig(fs.readFileSync(file, 'utf-8'));
      }
    } catch {
      // try next
    }
  }
  return { ...DEFAULT_PROJECT_CONFIG };
}

export function formatProjectConfig(config: ProjectConfig): string {
  const lines = [
    '# agentic-setup project configuration',
    `# ${GITHUB_REPO_URL}`,
    '',
    'version: 1',
    `agents: [${config.agents.join(', ')}]`,
    `profile: ${config.profile}`,
    `codegraph: ${config.codegraph}`,
    `analyze_on_setup: ${config.analyze_on_setup}`,
    `readiness_threshold: ${config.readiness_threshold}`,
    `config_score_threshold: ${config.config_score_threshold}`,
  ];
  if (config.ignore.length > 0) {
    lines.push('ignore:');
    for (const item of config.ignore) lines.push(`  - ${item}`);
  }
  lines.push('run:');
  lines.push(`  generate: ${config.run.generate}`);
  lines.push('ci:');
  lines.push(`  workflow: ${config.ci.workflow}`);
  lines.push('');
  return lines.join('\n');
}

export function writeProjectConfig(
  config: ProjectConfig,
  repoRoot: string = process.cwd(),
  options: { dryRun?: boolean } = {},
): { rootPath: string; internalPath: string } {
  const rootPath = path.join(repoRoot, PROJECT_CONFIG_FILENAME);
  const internalPath = path.join(repoRoot, PROJECT_CONFIG_INTERNAL);
  const content = formatProjectConfig(config);
  if (!options.dryRun) {
    if (!fs.existsSync(path.join(repoRoot, AGENTIC_DIR))) {
      fs.mkdirSync(path.join(repoRoot, AGENTIC_DIR), { recursive: true });
    }
    fs.writeFileSync(rootPath, content);
    fs.writeFileSync(internalPath, content);
  }
  return { rootPath, internalPath };
}

export function getAllIgnorePatterns(repoRoot: string): string[] {
  const config = readProjectConfig(repoRoot);
  return [...new Set([...config.ignore])];
}
