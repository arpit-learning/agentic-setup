import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.agentic-setup');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

let runtimeDisabled = false;

interface AgenticSetupConfig {
  machineId?: string;
  telemetryNoticeShown?: boolean;
  [key: string]: unknown;
}

function readConfig(): AgenticSetupConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as AgenticSetupConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: AgenticSetupConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function getMachineId(): string {
  const config = readConfig();
  if (config.machineId) return config.machineId;

  const machineId = crypto.randomUUID();
  writeConfig({ ...config, machineId });
  return machineId;
}

const EMAIL_HASH_KEY = 'agentic-telemetry-v1';

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'tuta.io',
]);

function getGitEmail(): string | undefined {
  try {
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
    return email || undefined;
  } catch {
    return undefined;
  }
}

export function getGitEmailHash(): string | undefined {
  const email = getGitEmail();
  if (!email) return undefined;
  return crypto.createHmac('sha256', EMAIL_HASH_KEY).update(email).digest('hex');
}

export function getGitEmailDomain(): string | undefined {
  const email = getGitEmail();
  if (!email || !email.includes('@')) return undefined;
  const domain = email.split('@')[1].toLowerCase();
  if (PERSONAL_DOMAINS.has(domain)) return undefined;
  return domain;
}

export function getGitEmailInfo(): { hash?: string; domain?: string } {
  const email = getGitEmail();
  if (!email) return {};
  const hash = crypto.createHmac('sha256', EMAIL_HASH_KEY).update(email).digest('hex');
  let domain: string | undefined;
  if (email.includes('@')) {
    const d = email.split('@')[1].toLowerCase();
    if (!PERSONAL_DOMAINS.has(d)) domain = d;
  }
  return { hash, domain };
}

export function getRepoHash(): string | undefined {
  try {
    const remote = execSync('git remote get-url origin || git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!remote) return undefined;
    return crypto.createHmac('sha256', EMAIL_HASH_KEY).update(remote).digest('hex').slice(0, 16);
  } catch {
    return undefined;
  }
}

export function isTelemetryEnabled(): boolean {
  if (runtimeDisabled) return false;
  const enabled = process.env.AGENTIC_SETUP_TELEMETRY;
  if (
    process.env.AGENTIC_SETUP_TELEMETRY_DISABLED === '1' ||
    process.env.AGENTIC_SETUP_TELEMETRY_DISABLED === 'true'
  ) {
    return false;
  }
  return enabled === '1' || enabled === 'true';
}

/** Telemetry is off by default; set AGENTIC_SETUP_TELEMETRY=1 to opt in. */
export function isTelemetryDisabled(): boolean {
  return !isTelemetryEnabled();
}

export function setTelemetryDisabled(disabled: boolean): void {
  runtimeDisabled = disabled;
}

export function wasNoticeShown(): boolean {
  return readConfig().telemetryNoticeShown === true;
}

export function markNoticeShown(): void {
  const config = readConfig();
  writeConfig({ ...config, telemetryNoticeShown: true });
}
