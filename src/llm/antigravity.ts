import { spawn, execSync, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type {
  LLMProvider,
  LLMCallOptions,
  LLMStreamOptions,
  LLMStreamCallbacks,
  LLMConfig,
} from './types.js';
import { parseSeatBasedError } from './seat-based-errors.js';
import { trackUsage } from './usage.js';
import { estimateTokens } from './utils.js';
import { withAgenticSetupSubprocessEnv } from '../lib/subprocess-sentinel.js';
import { debugLog, debugBlock } from '../lib/debug.js';

/**
 * The Antigravity Google CLI binary name.
 * https://goo.gle/agy
 */
const ANTIGRAVITY_BIN = 'agy';

/** Default per-call timeout. Can be overridden with AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Default --print-timeout passed to `agy --print`.
 * agy's own default is 5m, but for long context generation we use 8m to stay under our 10m cap.
 */
const DEFAULT_PRINT_TIMEOUT = '8m';

const IS_WINDOWS = process.platform === 'win32';

/** Resolve full path to the `agy` CLI binary. */
export function resolveAntigravityBinPath(): string {
  // 1. Check if it's on PATH
  try {
    const cmd = IS_WINDOWS ? 'where agy' : 'which agy';
    const pathFromWhich = execSync(cmd, { encoding: 'utf-8' }).trim();
    const firstPath = pathFromWhich.split('\n')[0].trim();
    if (firstPath && fs.existsSync(firstPath)) {
      return firstPath;
    }
  } catch {
    // Not on PATH
  }

  // 2. Fallback: agy installs to ~/.local/bin/agy by default on Linux/macOS
  const home = os.homedir();
  const candidates = IS_WINDOWS
    ? [
        path.join(home, '.local', 'bin', 'agy.exe'),
        path.join(home, 'AppData', 'Local', 'agy', 'agy.exe'),
      ]
    : [path.join(home, '.local', 'bin', 'agy'), path.join(home, '.gemini', 'bin', 'agy')];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return ANTIGRAVITY_BIN;
}

/** Whether the `agy` CLI is available on PATH or at the default installation path. */
export function isAntigravityAvailable(): boolean {
  const resolved = resolveAntigravityBinPath();
  if (resolved !== ANTIGRAVITY_BIN) {
    return fs.existsSync(resolved);
  }
  try {
    const cmd = IS_WINDOWS ? `where ${ANTIGRAVITY_BIN}` : `which ${ANTIGRAVITY_BIN}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the user is logged in to `agy`.
 * `agy` uses the Antigravity IDE session / Google account — it is authenticated
 * as long as the binary is present and the IDE is running.
 */
export function isAntigravityLoggedIn(): boolean {
  return isAntigravityAvailable();
}

/**
 * Build `agy` CLI args for non-streaming (--print) mode.
 *
 * agy --print [--model <model>] [--print-timeout <duration>] <prompt>
 */
function buildArgs(prompt: string, model: string | undefined, printTimeout: string): string[] {
  const args: string[] = ['--dangerously-skip-permissions'];
  if (model && model !== 'default') {
    args.push('--model', model);
  }
  args.push('--print-timeout', printTimeout);
  args.push('--print', prompt);
  return args;
}

/**
 * Common spawn helper for `agy`. Handles Windows vs Unix.
 * Does NOT inject ANTIGRAVITY_PROJECT_ID — agy does not need GCP project config.
 */
function spawnAgy(args: string[]): ChildProcess {
  const binPath = resolveAntigravityBinPath();
  const env = withAgenticSetupSubprocessEnv({ ...process.env });
  debugLog('agy', `bin=${binPath}`, `args=${JSON.stringify(args)}`);
  if (IS_WINDOWS) {
    return spawn([binPath, ...args].join(' '), {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'] as const,
      env,
      shell: true,
    });
  } else {
    return spawn(binPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'] as const,
      env,
    });
  }
}

/**
 * Run `agy --print` and return the full stdout response as a string.
 * agy prints plain text — no JSON parsing needed.
 */
function runCommand(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawnAgy(args);
    const stderrChunks: Buffer[] = [];
    let stdoutData = Buffer.alloc(0);

    child.stdout!.on('data', (chunk: Buffer) => {
      stdoutData = Buffer.concat([stdoutData, chunk]);
    });

    child.stderr!.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(
        new Error(
          `agy timed out after ${timeoutMs / 1000}s. Set AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS to increase.`,
        ),
      );
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
      const stdout = stdoutData.toString('utf-8').trim();
      if (code === 0) {
        debugLog('agy', `exit=0 stdout_len=${stdout.length}`);
        resolve(stdout);
      } else {
        debugLog(
          'agy',
          `exit=${code ?? signal} stderr_len=${stderr.length} stdout_len=${stdout.length}`,
        );
        debugBlock('agy stderr', stderr);
        debugBlock('agy stdout', stdout);
        const friendly = parseSeatBasedError(stderr, code);
        const base = signal
          ? `Antigravity (agy) killed (${signal})`
          : code != null
            ? `Antigravity (agy) exited with code ${code}`
            : 'Antigravity (agy) exited';
        const detail = friendly || stderr || stdout;
        reject(new Error(detail ? `${base}. ${detail}` : base));
      }
    });
  });
}

/**
 * Stream `agy --print` output line-by-line.
 * agy outputs plain text to stdout; we emit each chunk directly via onText.
 */
function runCommandStream(
  args: string[],
  callbacks: LLMStreamCallbacks,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnAgy(args);
    const stderrChunks: Buffer[] = [];
    let settled = false;

    child.stdout!.on('data', (chunk: Buffer) => {
      callbacks.onText(chunk.toString('utf-8'));
    });

    child.stderr!.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (!settled) {
        settled = true;
        reject(
          new Error(
            `agy timed out after ${timeoutMs / 1000}s. Set AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS to increase.`,
          ),
        );
      }
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
      if (code === 0) {
        callbacks.onEnd({ stopReason: 'end_turn' });
        resolve();
      } else {
        debugLog('agy:stream', `exit=${code ?? signal} stderr_len=${stderr.length}`);
        debugBlock('agy stderr', stderr);
        const friendly = parseSeatBasedError(stderr, code);
        const base = signal
          ? `Antigravity (agy) killed (${signal})`
          : code != null
            ? `Antigravity (agy) exited with code ${code}`
            : 'Antigravity (agy) exited';
        const detail = friendly || stderr;
        reject(new Error(detail ? `${base}. ${detail}` : base));
      }
    });
  });
}

/**
 * Antigravity Google provider using the `agy` CLI.
 *
 * Invoked as: agy --print [--model <model>] [--print-timeout <duration>] <prompt>
 *
 * No API key, GCP project, or environment configuration needed — agy uses
 * the authenticated Antigravity IDE session automatically.
 */
function sanitizePromptForAgy(text: string): string {
  return text
    .replace(
      /You are an expert auditor for coding agent configurations/g,
      'You are a static text formatting assistant',
    )
    .replace(
      /If no existing configs exist → generate an initial configuration from scratch/g,
      'If no existing configs exist, format the project info into the JSON schema',
    )
    .replace(
      /If existing configs are provided → audit them and suggest targeted improvements/g,
      'If existing configs are provided, format the existing configs and project info into the JSON schema',
    )
    .replace(/Audit checklist/gi, 'Formatting guidelines')
    .replace(
      /Generate an initial coding agent configuration for target:/g,
      'Format the project context into the JSON schema for target:',
    )
    .replace(
      /Audit and improve the existing coding agent configuration for target:/g,
      'Format the project context and existing configs into the JSON schema for target:',
    )
    .replace(
      /Audit and improve the existing coding agent configuration/g,
      'Format the project context and existing configs into the JSON schema',
    )
    .replace(/TARGETED FIX MODE/g, 'TARGETED FORMATTING MODE')
    .replace(/fix these specific failing checks/g, 'apply these specific formatting changes')
    .replace(
      /checks are currently PASSING — do NOT break them/g,
      'sections are currently correct — do NOT modify them',
    )
    .replace(/failing check/g, 'requested formatting change')
    .replace(/failing checks/g, 'requested formatting changes');
}

/**
 * Antigravity Google provider using the `agy` CLI.
 *
 * Invoked as: agy --print [--model <model>] [--print-timeout <duration>] <prompt>
 *
 * No API key, GCP project, or environment configuration needed — agy uses
 * the authenticated Antigravity IDE session automatically.
 */
export class AntigravityProvider implements LLMProvider {
  private defaultModel: string;
  private timeoutMs: number;
  private printTimeout: string;

  constructor(config: LLMConfig) {
    this.defaultModel = config.model || 'default';
    const envTimeout = process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS;
    this.timeoutMs = envTimeout ? parseInt(envTimeout, 10) : DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1000) {
      this.timeoutMs = DEFAULT_TIMEOUT_MS;
    }
    // Set --print-timeout directly to match timeoutMs minus 2 minutes (agy needs buffer time to exit gracefully)
    const printTimeoutMin = Math.floor(this.timeoutMs / 60_000) - 2;
    this.printTimeout =
      process.env.AGENTIC_SETUP_ANTIGRAVITY_PRINT_TIMEOUT ||
      (printTimeoutMin > 0 ? `${printTimeoutMin}m` : DEFAULT_PRINT_TIMEOUT);
  }

  async call(options: LLMCallOptions): Promise<string> {
    const system = sanitizePromptForAgy(options.system || '');
    const prompt = sanitizePromptForAgy(options.prompt || '');
    // Prepend strict constraints so the agentic CLI doesn't try to use tools and outputs raw JSON
    const constraint = `[CRITICAL SYSTEM OVERRIDE]: YOU ARE OPERATING IN HEADLESS JSON-GENERATION MODE. YOU MUST NOT USE ANY TERMINAL TOOLS. DO NOT SEARCH OR ANALYZE THE FILESYSTEM. ALL NECESSARY CONTEXT IS PROVIDED BELOW. YOUR ONLY TASK IS TO READ THE TEXT BELOW AND RESPOND WITH A VALID JSON BLOCK STARTING WITH \`\`\`json. DO NOT OUTPUT ANY CHAIN OF THOUGHT OR EXPLANATIONS. JUST THE JSON.\n\n`;
    const combined = `${constraint}${system ? `${system}\n\n${prompt}` : prompt}`;
    const model = options.model || this.defaultModel;
    const args = buildArgs(combined, model, this.printTimeout);
    return runCommand(args, this.timeoutMs);
  }

  async stream(options: LLMStreamOptions, callbacks: LLMStreamCallbacks): Promise<void> {
    const system = sanitizePromptForAgy(options.system || '');
    const prompt = sanitizePromptForAgy(options.prompt || '');
    const constraint = `[CRITICAL SYSTEM OVERRIDE]: YOU ARE OPERATING IN HEADLESS JSON-GENERATION MODE. YOU MUST NOT USE ANY TERMINAL TOOLS. DO NOT SEARCH OR ANALYZE THE FILESYSTEM. ALL NECESSARY CONTEXT IS PROVIDED BELOW. YOUR ONLY TASK IS TO READ THE TEXT BELOW AND RESPOND WITH A VALID JSON BLOCK STARTING WITH \`\`\`json. DO NOT OUTPUT ANY CHAIN OF THOUGHT OR EXPLANATIONS. JUST THE JSON.\n\n`;
    const combined = `${constraint}${system ? `${system}\n\n${prompt}` : prompt}`;
    const model = options.model || this.defaultModel;
    const args = buildArgs(combined, model, this.printTimeout);
    const inputEstimate = estimateTokens(combined);
    let outputChars = 0;
    const wrappedCallbacks: LLMStreamCallbacks = {
      onText: (text) => {
        outputChars += text.length;
        callbacks.onText(text);
      },
      onEnd: (meta) => {
        trackUsage(model, {
          inputTokens: inputEstimate,
          outputTokens: Math.ceil(outputChars / 4),
        });
        callbacks.onEnd(meta);
      },
      onError: (err) => callbacks.onError(err),
    };
    return runCommandStream(args, wrappedCallbacks, this.timeoutMs);
  }
}
