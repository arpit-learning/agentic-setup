import fs from 'fs';
import type { ProviderType, LLMConfig } from './types.js';
import { loadConfig } from './config.js';
import {
  isCursorAgentAvailable,
  isCursorLoggedIn,
  resetAgentBin,
  resetCursorLoginCache,
} from './cursor-acp.js';
import {
  isClaudeCliAvailable,
  isClaudeCliLoggedIn,
  resetClaudeCliBin,
  resetClaudeCliLoginCache,
} from './claude-cli.js';
import { isOpenCodeAvailable, isOpenCodeLoggedIn, resetOpenCodeLoginCache } from './opencode.js';

export interface ValidationError {
  ok: false;
  provider: ProviderType;
  error: string; // Short error title
  detail: string; // Long explanation with next steps
  recoveryOptions: Array<{
    label: string; // Short label for user
    action: 'fix-now' | 'switch-provider' | 'skip' | 'exit';
  }>;
}

export interface ValidationSuccess {
  ok: true;
}

export type ValidationResult = ValidationSuccess | ValidationError;

/**
 * Validate Anthropic API key format and presence.
 * Checks for env var and basic format (non-empty, starts with 'sk-ant-').
 */
function validateAnthropicKey(config: LLMConfig): ValidationResult {
  const key = config.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!key || key.trim().length === 0) {
    return {
      ok: false,
      provider: 'anthropic',
      error: 'Missing Anthropic API Key',
      detail: `The ANTHROPIC_API_KEY environment variable is not set or is empty.

To fix:
1. Get an API key from https://console.anthropic.com/keys
2. Run: export ANTHROPIC_API_KEY=sk-ant-<your-key-here>
3. Then retry: agentic-setup init`,
      recoveryOptions: [
        { label: 'Set API key', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  // Basic format validation
  if (!key.startsWith('sk-ant-')) {
    return {
      ok: false,
      provider: 'anthropic',
      error: 'Invalid Anthropic API Key Format',
      detail: `The ANTHROPIC_API_KEY has an invalid format.

Anthropic API keys should start with 'sk-ant-'.
Current value starts with: '${key.slice(0, 10)}...'

To fix:
1. Check your key at https://console.anthropic.com/keys
2. Update ANTHROPIC_API_KEY with the correct value
3. Then retry: agentic-setup init`,
      recoveryOptions: [
        { label: 'Set API key', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  return { ok: true };
}

/**
 * Validate OpenAI API key format and presence.
 */
function validateOpenAiKey(config: LLMConfig): ValidationResult {
  const key = config.apiKey || process.env.OPENAI_API_KEY;

  if (!key || key.trim().length === 0) {
    return {
      ok: false,
      provider: 'openai',
      error: 'Missing OpenAI API Key',
      detail: `The OPENAI_API_KEY environment variable is not set or is empty.

To fix:
1. Get an API key from https://platform.openai.com/keys
2. Run: export OPENAI_API_KEY=sk-<your-key-here>
3. Then retry: agentic-setup init`,
      recoveryOptions: [
        { label: 'Set API key', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  // Basic format validation — OpenAI keys start with 'sk-'
  if (!key.startsWith('sk-')) {
    return {
      ok: false,
      provider: 'openai',
      error: 'Invalid OpenAI API Key Format',
      detail: `The OPENAI_API_KEY has an invalid format.

OpenAI API keys should start with 'sk-'.
Current value starts with: '${key.slice(0, 5)}...'

To fix:
1. Check your key at https://platform.openai.com/keys
2. Update OPENAI_API_KEY with the correct value
3. Then retry: agentic-setup init`,
      recoveryOptions: [
        { label: 'Set API key', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  return { ok: true };
}

/**
 * Validate MiniMax API key format and presence.
 */
function validateMiniMaxKey(config: LLMConfig): ValidationResult {
  const key = config.apiKey || process.env.MINIMAX_API_KEY;

  if (!key || key.trim().length === 0) {
    return {
      ok: false,
      provider: 'openai', // Use 'openai' as a generic fallback for minimax
      error: 'Missing MiniMax API Key',
      detail: `The MINIMAX_API_KEY environment variable is not set or is empty.

To fix:
1. Get an API key from MiniMax console
2. Run: export MINIMAX_API_KEY=<your-key-here>
3. Then retry: agentic-setup init`,
      recoveryOptions: [
        { label: 'Set API key', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  return { ok: true };
}

/**
 * Validate Vertex AI configuration.
 * Checks for project ID and credential file/JSON validity.
 */
function validateVertexConfig(config: LLMConfig): ValidationResult {
  const projectId =
    config.vertexProjectId || process.env.VERTEX_PROJECT_ID || process.env.GCP_PROJECT_ID;

  if (!projectId || projectId.trim().length === 0) {
    return {
      ok: false,
      provider: 'vertex',
      error: 'Missing Vertex AI Project ID',
      detail: `The VERTEX_PROJECT_ID or GCP_PROJECT_ID environment variable is not set.

To fix:
1. Get your GCP project ID from https://console.cloud.google.com
2. Run: export VERTEX_PROJECT_ID=<your-project-id>
3. Then retry: agentic-setup init

Optional: Set credentials file via:
  export VERTEX_SA_CREDENTIALS=/path/to/sa-key.json
  or
  export VERTEX_SA_CREDENTIALS='{"type":"service_account",...}'`,
      recoveryOptions: [
        { label: 'Set project ID', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  // Validate credentials if provided
  const credentialsPath =
    config.vertexCredentials ||
    process.env.VERTEX_SA_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    const raw = credentialsPath.trim();
    if (raw.startsWith('{')) {
      // Try to parse as JSON
      try {
        JSON.parse(raw);
      } catch {
        return {
          ok: false,
          provider: 'vertex',
          error: 'Invalid Vertex Credentials JSON',
          detail: `The VERTEX_SA_CREDENTIALS contains invalid JSON.

To fix:
1. Verify the JSON is valid
2. Or use a file path instead: export VERTEX_SA_CREDENTIALS=/path/to/sa-key.json
3. Then retry: agentic-setup init`,
          recoveryOptions: [
            { label: 'Fix credentials', action: 'fix-now' },
            { label: 'Switch provider', action: 'switch-provider' },
            { label: 'Skip detection', action: 'skip' },
          ],
        };
      }
    } else {
      // Try to read as a file
      try {
        if (!fs.existsSync(raw)) {
          return {
            ok: false,
            provider: 'vertex',
            error: 'Vertex Credentials File Not Found',
            detail: `The credentials file does not exist: ${raw}

To fix:
1. Verify the path is correct
2. Or use JSON directly: export VERTEX_SA_CREDENTIALS='{"type":"service_account",...}'
3. Then retry: agentic-setup init`,
            recoveryOptions: [
              { label: 'Fix path', action: 'fix-now' },
              { label: 'Switch provider', action: 'switch-provider' },
              { label: 'Skip detection', action: 'skip' },
            ],
          };
        }
        const content = fs.readFileSync(raw, 'utf-8');
        JSON.parse(content);
      } catch (err) {
        return {
          ok: false,
          provider: 'vertex',
          error: 'Invalid Vertex Credentials File',
          detail: `Cannot read or parse credentials file: ${raw}

Error: ${err instanceof Error ? err.message : String(err)}

To fix:
1. Check the file path is correct
2. Check the file contains valid JSON
3. Then retry: agentic-setup init`,
          recoveryOptions: [
            { label: 'Fix file', action: 'fix-now' },
            { label: 'Switch provider', action: 'switch-provider' },
            { label: 'Skip detection', action: 'skip' },
          ],
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Validate Cursor agent CLI availability and login status.
 */
function validateCursorCli(): ValidationResult {
  // Reset caches for fresh check
  resetAgentBin();
  resetCursorLoginCache();

  if (!isCursorAgentAvailable()) {
    return {
      ok: false,
      provider: 'cursor',
      error: 'Cursor Agent CLI Not Installed',
      detail: `The Cursor Agent CLI is not installed or not found on PATH.

To fix:
1. Install Cursor from https://cursor.com/install
2. After installation, open Cursor once to complete setup
3. Then retry: agentic-setup init

Or choose a different provider:
  export ANTHROPIC_API_KEY=sk-ant-<your-key>
  agentic-setup init`,
      recoveryOptions: [
        { label: 'Install & retry', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  if (!isCursorLoggedIn()) {
    return {
      ok: false,
      provider: 'cursor',
      error: 'Cursor Agent CLI Not Logged In',
      detail: `Cursor Agent CLI is installed but you're not logged in.

To fix:
1. Run: agent login
2. Follow the authentication flow
3. Then retry: agentic-setup init

Or choose a different provider:
  export ANTHROPIC_API_KEY=sk-ant-<your-key>
  agentic-setup init`,
      recoveryOptions: [
        { label: 'Login & retry', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  return { ok: true };
}

/**
 * Validate Claude Code CLI availability and login status.
 */
function validateClaudeCodeCli(): ValidationResult {
  // Reset caches for fresh check
  resetClaudeCliBin();
  resetClaudeCliLoginCache();

  if (!isClaudeCliAvailable()) {
    return {
      ok: false,
      provider: 'claude-cli',
      error: 'Claude Code CLI Not Installed',
      detail: `The Claude Code CLI is not installed or not found.

To fix:
1. Install Claude from https://claude.ai/install
2. Or if already installed, run: which claude (to verify)
3. Then retry: agentic-setup init

Or choose a different provider:
  export ANTHROPIC_API_KEY=sk-ant-<your-key>
  agentic-setup init`,
      recoveryOptions: [
        { label: 'Install & retry', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  if (!isClaudeCliLoggedIn()) {
    return {
      ok: false,
      provider: 'claude-cli',
      error: 'Claude Code CLI Not Logged In',
      detail: `Claude Code CLI is installed but you're not logged in.

To fix:
1. Run: claude
2. You'll be prompted to log in through your browser
3. Complete the authentication flow
4. Then retry: agentic-setup init

Or choose a different provider:
  export ANTHROPIC_API_KEY=sk-ant-<your-key>
  agentic-setup init`,
      recoveryOptions: [
        { label: 'Login & retry', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  return { ok: true };
}

/**
 * Validate OpenCode CLI availability and login status.
 */
function validateOpenCodeCli(): ValidationResult {
  // Reset cache for fresh check
  resetOpenCodeLoginCache();

  if (!isOpenCodeAvailable()) {
    return {
      ok: false,
      provider: 'opencode',
      error: 'OpenCode CLI Not Installed',
      detail: `The OpenCode CLI is not installed or not found.

To fix:
1. Install OpenCode from https://opencode.ai
2. Then retry: agentic-setup init

Or choose a different provider:
  export ANTHROPIC_API_KEY=sk-ant-<your-key>
  agentic-setup init`,
      recoveryOptions: [
        { label: 'Install & retry', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  if (!isOpenCodeLoggedIn()) {
    return {
      ok: false,
      provider: 'opencode',
      error: 'OpenCode CLI Not Logged In',
      detail: `OpenCode CLI is installed but you're not logged in.

To fix:
1. Run: opencode auth login
2. Follow the authentication flow
3. Then retry: agentic-setup init

Or choose a different provider:
  export ANTHROPIC_API_KEY=sk-ant-<your-key>
  agentic-setup init`,
      recoveryOptions: [
        { label: 'Login & retry', action: 'fix-now' },
        { label: 'Switch provider', action: 'switch-provider' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  return { ok: true };
}

/**
 * Main pre-flight validation entry point.
 * Loads config and validates the active provider.
 * Returns { ok: true } if validation passes, or a detailed error with recovery options.
 */
export function validateLlmSetup(): ValidationResult {
  const config = loadConfig();

  if (!config) {
    return {
      ok: false,
      provider: 'anthropic', // Default fallback provider
      error: 'No LLM Provider Configured',
      detail: `No LLM provider is configured or detected.

Available options:

1. Use Anthropic (Claude):
   export ANTHROPIC_API_KEY=sk-ant-<your-key>
   agentic-setup init

2. Use OpenAI:
   export OPENAI_API_KEY=sk-<your-key>
   agentic-setup init

3. Use Google Vertex AI:
   export VERTEX_PROJECT_ID=<your-project>
   agentic-setup init

4. Use Cursor (installed locally):
   agent login
   agentic-setup init

5. Use Claude Code CLI (installed locally):
   claude
   agentic-setup init

6. Or run the interactive setup:
   agentic-setup config`,
      recoveryOptions: [
        { label: 'Setup provider', action: 'fix-now' },
        { label: 'Skip detection', action: 'skip' },
      ],
    };
  }

  // Validate the active provider
  switch (config.provider) {
    case 'anthropic':
      return validateAnthropicKey(config);
    case 'openai':
      return validateOpenAiKey(config);
    case 'minimax':
      return validateMiniMaxKey(config);
    case 'vertex':
      return validateVertexConfig(config);
    case 'cursor':
      return validateCursorCli();
    case 'claude-cli':
      return validateClaudeCodeCli();
    case 'opencode':
      return validateOpenCodeCli();
    default:
      return {
        ok: false,
        provider: 'anthropic',
        error: `Unknown Provider: ${config.provider}`,
        detail: `The configured provider "${config.provider}" is not recognized.

Please run: agentic-setup config`,
        recoveryOptions: [
          { label: 'Setup provider', action: 'fix-now' },
          { label: 'Skip detection', action: 'skip' },
        ],
      };
  }
}
