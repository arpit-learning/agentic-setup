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

const ANTIGRAVITY_BIN = 'agentapi';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const IS_WINDOWS = process.platform === 'win32';

/** Resolve full path to antigravity CLI binary (agentapi). */
export function resolveAntigravityBinPath(): string {
  // 1. Check if it's on PATH
  try {
    const cmd = IS_WINDOWS ? 'where agentapi' : 'which agentapi';
    const pathFromWhich = execSync(cmd, { encoding: 'utf-8' }).trim();
    const firstPath = pathFromWhich.split('\n')[0].trim();
    if (firstPath && fs.existsSync(firstPath)) {
      return firstPath;
    }
  } catch {
    // Not on PATH
  }

  // 2. Fallback to default installation path
  const home = os.homedir();
  const defaultPath = IS_WINDOWS
    ? path.join(home, '.gemini', 'antigravity-ide', 'bin', 'agentapi.exe')
    : path.join(home, '.gemini', 'antigravity-ide', 'bin', 'agentapi');

  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return 'agentapi';
}

/** Whether the antigravity CLI is on PATH or at the default installation path. */
export function isAntigravityAvailable(): boolean {
  const resolved = resolveAntigravityBinPath();
  if (resolved !== 'agentapi') {
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

/** Whether the user is logged in to antigravity CLI. Since agentapi uses the IDE session, it is always authenticated. */
export function isAntigravityLoggedIn(): boolean {
  return isAntigravityAvailable();
}

/**
 * Common spawn helper for Antigravity. Handles Windows vs Unix.
 */
function spawnAntigravity(args: string[], config: LLMConfig): ChildProcess {
  const binPath = resolveAntigravityBinPath();
  const env = withAgenticSetupSubprocessEnv({
    ...process.env,
    ANTIGRAVITY_PROJECT_ID:
      config.vertexProjectId ||
      process.env.ANTIGRAVITY_PROJECT_ID ||
      process.env.VERTEX_PROJECT_ID ||
      process.env.GCP_PROJECT_ID ||
      '',
  });
  if (IS_WINDOWS) {
    return spawn([binPath, ...args].join(' '), {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'] as const,
      env,
      shell: true,
    });
  } else {
    return spawn(binPath, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'] as const,
      env,
    });
  }
}

/**
 * Run a non-streaming Antigravity command and return the stdout as string.
 * Handles timeout and error parsing.
 */
function runCommand(args: string[], timeoutMs: number, config: LLMConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawnAntigravity(args, config);
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
          `Antigravity timed out after ${timeoutMs / 1000}s. Set AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS to increase.`,
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
      if (code === 0) {
        resolve(stdoutData.toString('utf-8').trim());
      } else {
        const friendly = parseSeatBasedError(stderr, code);
        const base = signal
          ? `Antigravity killed (${signal})`
          : code != null
            ? `Antigravity exited with code ${code}`
            : 'Antigravity exited';
        const detail = friendly || stderr || stdoutData.toString('utf-8').trim();
        reject(new Error(detail ? `${base}. ${detail}` : base));
      }
    });
  });
}

/**
 * Stream Antigravity response, parsing JSON lines for text events.
 */
function runCommandStream(
  args: string[],
  callbacks: LLMStreamCallbacks,
  timeoutMs: number,
  config: LLMConfig,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnAntigravity(args, config);
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let lineBuffer = '';

    child.stdout!.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      lineBuffer += text;
      const lines = lineBuffer.split('\n');
      // The last element may be incomplete; keep it in buffer.
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.error) {
            callbacks.onError(new Error(event.error));
            return;
          }
          if (event.response) {
            if (typeof event.response.text === 'string') {
              callbacks.onText(event.response.text);
            } else if (typeof event.response.content === 'string') {
              callbacks.onText(event.response.content);
            } else if (typeof event.response === 'string') {
              callbacks.onText(event.response);
            }
          } else if (event.type === 'text' && event.part?.text) {
            callbacks.onText(event.part.text);
          } else if (typeof event.text === 'string') {
            callbacks.onText(event.text);
          }
        } catch {
          // If it's not JSON, treat it as raw text chunk
          callbacks.onText(line);
        }
      }
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
            `Antigravity timed out after ${timeoutMs / 1000}s. Set AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS to increase.`,
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
      if (code === 0) {
        // Process any remaining line buffer
        if (lineBuffer.trim()) {
          try {
            const event = JSON.parse(lineBuffer);
            if (event.response) {
              if (typeof event.response.text === 'string') {
                callbacks.onText(event.response.text);
              } else if (typeof event.response.content === 'string') {
                callbacks.onText(event.response.content);
              }
            } else if (typeof event.text === 'string') {
              callbacks.onText(event.text);
            }
          } catch {
            callbacks.onText(lineBuffer);
          }
        }
        callbacks.onEnd({ stopReason: 'end_turn' });
        resolve();
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        const friendly = parseSeatBasedError(stderr, code);
        const base = signal
          ? `Antigravity killed (${signal})`
          : code != null
            ? `Antigravity exited with code ${code}`
            : 'Antigravity exited';
        const detail = friendly || stderr;
        reject(new Error(detail ? `${base}. ${detail}` : base));
      }
    });
  });
}

/**
 * Antigravity provider using the Antigravity CLI.
 */
export class AntigravityProvider implements LLMProvider {
  private defaultModel: string;
  private timeoutMs: number;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.defaultModel = config.model || 'default';
    const envTimeout = process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS;
    this.timeoutMs = envTimeout ? parseInt(envTimeout, 10) : DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1000) {
      this.timeoutMs = DEFAULT_TIMEOUT_MS;
    }
  }

  async call(options: LLMCallOptions): Promise<string> {
    const system = options.system || '';
    const prompt = options.prompt || '';
    const combined = system + '\n\n' + prompt;
    const model = options.model || this.defaultModel;
    const args = ['new-conversation'];
    if (model && model !== 'default') {
      args.push(`--model=${model}`);
    }
    args.push(combined);
    const resultJson = await runCommand(args, this.timeoutMs, this.config);
    try {
      const parsed = JSON.parse(resultJson);
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      if (parsed.response) {
        if (typeof parsed.response.text === 'string') return parsed.response.text;
        if (typeof parsed.response.content === 'string') return parsed.response.content;
        if (typeof parsed.response.message === 'string') return parsed.response.message;
        if (typeof parsed.response === 'string') return parsed.response;
        return JSON.stringify(parsed.response);
      }
      return resultJson;
    } catch {
      return resultJson;
    }
  }

  async stream(options: LLMStreamOptions, callbacks: LLMStreamCallbacks): Promise<void> {
    const system = options.system || '';
    const prompt = options.prompt || '';
    const combined = system + '\n\n' + prompt;
    const model = options.model || this.defaultModel;
    const args = ['new-conversation'];
    if (model && model !== 'default') {
      args.push(`--model=${model}`);
    }
    args.push(combined);
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
    return runCommandStream(args, wrappedCallbacks, this.timeoutMs, this.config);
  }
}
