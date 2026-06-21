import type { LLMProvider, LLMConfig, LLMCallOptions } from './types.js';
import { loadConfig } from './config.js';
import { AnthropicProvider } from './anthropic.js';
import { VertexProvider } from './vertex.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { MiniMaxProvider } from './minimax.js';
import { CursorAcpProvider, isCursorAgentAvailable, isCursorLoggedIn } from './cursor-acp.js';
import { ClaudeCliProvider, isClaudeCliAvailable, isClaudeCliLoggedIn } from './claude-cli.js';
import { OpenCodeProvider, isOpenCodeAvailable, isOpenCodeLoggedIn } from './opencode.js';
import {
  AntigravityProvider,
  isAntigravityAvailable,
  isAntigravityLoggedIn,
} from './antigravity.js';
import { parseJsonResponse, extractJson, estimateTokens } from './utils.js';
import { isModelNotAvailableError, handleModelNotAvailable } from './model-recovery.js';
import { isRateLimitError } from './seat-based-errors.js';
import { displayProductName } from '../lib/resolve-cli.js';

export type { LLMProvider, LLMConfig, LLMCallOptions };
export type { LLMStreamOptions, LLMStreamCallbacks, ProviderType } from './types.js';
export { isSeatBased } from './types.js';
export { loadConfig, writeConfigFile, getConfigFilePath, getFastModel } from './config.js';
export { parseJsonResponse, extractJson, estimateTokens };
export { isModelNotAvailableError, handleModelNotAvailable } from './model-recovery.js';
export { trackUsage, getUsageSummary, resetUsage } from './usage.js';
export type { TokenUsage } from './types.js';

let cachedProvider: LLMProvider | null = null;
let cachedConfig: LLMConfig | null = null;

function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'vertex':
      return new VertexProvider(config);
    case 'openai':
      return new OpenAICompatProvider(config);
    case 'minimax':
      return new MiniMaxProvider(config);
    case 'cursor': {
      if (!isCursorAgentAvailable()) {
        throw new Error(
          'Cursor provider requires the Cursor Agent CLI. Install it from https://cursor.com/install then run `agent login`. Alternatively set ANTHROPIC_API_KEY or another provider.',
        );
      }
      if (!isCursorLoggedIn()) {
        throw new Error(
          'Cursor Agent CLI is installed but not logged in. Run `agent login` in your terminal to authenticate, then retry.',
        );
      }
      return new CursorAcpProvider(config);
    }
    case 'claude-cli': {
      if (!isClaudeCliAvailable()) {
        throw new Error(
          'Claude Code provider requires the Claude Code CLI. Install it from https://claude.ai/install (or run `claude` once and log in). Alternatively set ANTHROPIC_API_KEY or choose another provider.',
        );
      }
      if (!isClaudeCliLoggedIn()) {
        throw new Error(
          'Claude Code CLI is installed but not logged in. Run `claude` in your terminal to log in, then retry.',
        );
      }
      return new ClaudeCliProvider(config);
    }
    case 'opencode': {
      if (!isOpenCodeAvailable()) {
        throw new Error(
          'OpenCode provider requires the OpenCode CLI. Install it from https://opencode.ai then run `opencode auth login`. Alternatively set ANTHROPIC_API_KEY or choose another provider.',
        );
      }
      if (!isOpenCodeLoggedIn()) {
        throw new Error(
          'OpenCode CLI is installed but not logged in. Run `opencode auth login` in your terminal to authenticate, then retry.',
        );
      }
      return new OpenCodeProvider(config);
    }
    case 'antigravity': {
      if (!isAntigravityAvailable()) {
        throw new Error(
          'Antigravity provider requires the `agy` CLI. Install it from https://goo.gle/agy and run `agy` once to authenticate. Alternatively set ANTHROPIC_API_KEY or choose another provider.',
        );
      }
      if (!isAntigravityLoggedIn()) {
        throw new Error(
          'Antigravity CLI (agy) is installed but not authenticated. Run `agy` once and sign in with your Google account, then retry.',
        );
      }
      return new AntigravityProvider(config);
    }

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const config = loadConfig();
  if (!config) {
    throw new Error(
      `No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, MINIMAX_API_KEY, or VERTEX_PROJECT_ID; or run \`${displayProductName()} config\` and choose Cursor, Claude Code, OpenCode, or Antigravity; or set AGENTIC_SETUP_USE_CURSOR_SEAT=1 / AGENTIC_SETUP_USE_CLAUDE_CLI=1 / AGENTIC_SETUP_USE_OPENCODE=1 / AGENTIC_SETUP_USE_ANTIGRAVITY=1.`,
    );
  }

  cachedConfig = config;
  cachedProvider = createProvider(config);
  return cachedProvider;
}

export function getConfig(): LLMConfig {
  if (cachedConfig) return cachedConfig;

  const config = loadConfig();
  if (!config) {
    throw new Error(
      `No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, MINIMAX_API_KEY, or VERTEX_PROJECT_ID; or run \`${displayProductName()} config\` and choose Cursor, Claude Code, OpenCode, or Antigravity; or set AGENTIC_SETUP_USE_CURSOR_SEAT=1 / AGENTIC_SETUP_USE_CLAUDE_CLI=1 / AGENTIC_SETUP_USE_OPENCODE=1 / AGENTIC_SETUP_USE_ANTIGRAVITY=1.`,
    );
  }

  cachedConfig = config;
  return config;
}

export function resetProvider(): void {
  cachedProvider = null;
  cachedConfig = null;
}

export const TRANSIENT_ERRORS = [
  'terminated',
  'ECONNRESET',
  'ETIMEDOUT',
  'socket hang up',
  'other side closed',
];
const MAX_RETRIES = 3;

function isTransientError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return TRANSIENT_ERRORS.some((e) => msg.includes(e.toLowerCase()));
}

function isOverloaded(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes('529') || err.message.includes('overloaded');
}

export async function llmCall(options: LLMCallOptions): Promise<string> {
  const provider = getProvider();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await provider.call(options);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Model not available — prompt the user to pick an alternative
      if (isModelNotAvailableError(error) && cachedConfig && !options.skipModelRecovery) {
        const failedModel = options.model || cachedConfig.model;
        const newModel = await handleModelNotAvailable(failedModel, provider, cachedConfig);
        if (newModel) {
          resetProvider();
          const newProvider = getProvider();
          return await newProvider.call({ ...options, model: newModel });
        }
        throw error;
      }

      if (isOverloaded(error) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }

      if (isRateLimitError(error.message) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
        continue;
      }

      if (isTransientError(error) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }

      throw error;
    }
  }

  throw new Error('LLM call failed after max retries');
}

export async function llmJsonCall<T>(options: LLMCallOptions): Promise<T> {
  const text = await llmCall(options);
  return parseJsonResponse<T>(text);
}

/**
 * Lightweight model probe — sends a minimal request to verify the configured
 * model (and optionally the fast model) is reachable. If the model is not
 * available, triggers the interactive recovery flow so the user can pick an
 * alternative *before* the real workload starts (especially streaming calls
 * where mid-flight recovery is harder).
 *
 * Call this early in any command that uses streaming or long-running LLM work.
 */
export async function validateModel(options?: { fast?: boolean }): Promise<void> {
  const provider = getProvider();
  const config = cachedConfig;
  if (!config) return;

  const { isSeatBased } = await import('./types.js');
  const { getFastModel } = await import('./config.js');

  // Seat-based providers skip default-model validation, but stack detection still
  // uses the fast/scan model — validate it when requested (e.g. init Step 1).
  if (isSeatBased(config.provider)) {
    if (!options?.fast) return;
    const fast = getFastModel();
    if (!fast || fast === config.model) return;
    await probeModel(fast, provider, config);
    return;
  }

  const modelsToCheck = [config.model];
  if (options?.fast) {
    const fast = getFastModel();
    if (fast && fast !== config.model) modelsToCheck.push(fast);
  }

  for (const model of modelsToCheck) {
    await probeModel(model, provider, config);
  }
}

async function probeModel(model: string, provider: LLMProvider, config: LLMConfig): Promise<void> {
  try {
    await provider.call({
      system: 'Respond with OK',
      prompt: 'ping',
      model,
      maxTokens: 1,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (isModelNotAvailableError(error)) {
      const newModel = await handleModelNotAvailable(model, provider, config);
      if (newModel) {
        resetProvider();
        return;
      }
      throw error;
    }
    // Non-model errors (network, auth) — don't block startup, let the real call handle it
  }
}
