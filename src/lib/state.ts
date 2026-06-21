import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { AGENTIC_DIR, SUPPORTED_TARGET_AGENTS, type SupportedTargetAgent } from '../constants.js';

const STATE_FILE = path.join(AGENTIC_DIR, '.agentic-state.json');

interface AgenticState {
  lastRefreshSha: string;
  lastRefreshTimestamp: string;
  targetAgent?: SupportedTargetAgent[];
}

function normalizeTargetAgent(value: unknown): SupportedTargetAgent[] | undefined {
  if (Array.isArray(value)) return value as SupportedTargetAgent[];
  if (typeof value === 'string') {
    if (value === 'both') return ['claude', 'cursor'];
    if ((SUPPORTED_TARGET_AGENTS as readonly string[]).includes(value))
      return [value as SupportedTargetAgent];
  }
  return undefined;
}

export function readState(): AgenticState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (raw.targetAgent) raw.targetAgent = normalizeTargetAgent(raw.targetAgent);
    return raw;
  } catch {
    return null;
  }
}

export function writeState(state: AgenticState): void {
  if (!fs.existsSync(AGENTIC_DIR)) {
    fs.mkdirSync(AGENTIC_DIR, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getCurrentHeadSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}
