import chalk from 'chalk';
import * as p from '@clack/prompts';
import { writeConfigFile, DEFAULT_MODELS } from '../llm/config.js';
import type { ProviderType, LLMConfig } from '../llm/types.js';
import {
  isCursorAgentAvailable,
  isCursorLoggedIn,
  listCursorModels,
  ensureBashShim,
} from '../llm/cursor-acp.js';
import { isClaudeCliAvailable, isClaudeCliLoggedIn } from '../llm/claude-cli.js';
import { isOpenCodeAvailable, isOpenCodeLoggedIn } from '../llm/opencode.js';
import { isAntigravityAvailable } from '../llm/antigravity.js';
import { promptInput } from '../utils/prompt.js';

const IS_WINDOWS = process.platform === 'win32';

const PROVIDER_CHOICES: Array<{ name: string; value: ProviderType }> = [
  { name: 'Claude Code — use your existing subscription (no API key)', value: 'claude-cli' },
  { name: 'OpenCode — use your existing subscription (no API key)', value: 'opencode' },
  { name: 'Cursor — use your existing subscription (no API key)', value: 'cursor' },
  { name: 'Antigravity — use your existing subscription (no API key)', value: 'antigravity' },
  { name: 'Anthropic — API key from console.anthropic.com', value: 'anthropic' },
  { name: 'Google Vertex AI — Claude models via GCP', value: 'vertex' },
  { name: 'OpenAI — or any OpenAI-compatible endpoint', value: 'openai' },
  { name: 'MiniMax — API key from platform.minimax.io', value: 'minimax' },
];

/**
 * Interactive provider selection and setup. Prompts for provider choice and any
 * required inputs (API key, project ID, etc.), writes config to disk, and returns the config.
 * Used by both `agentic-setup config` and by `agentic-setup init` on first run (no config yet).
 */
export async function runInteractiveProviderSetup(options?: {
  selectMessage?: string;
}): Promise<LLMConfig> {
  const message = options?.selectMessage ?? 'Select LLM provider';
  const resultProvider = await p.select({
    message,
    options: PROVIDER_CHOICES.map((c) => ({ label: c.name, value: c.value })),
  });

  if (p.isCancel(resultProvider)) {
    p.cancel('Cancelled.');
    throw new Error('__exit__');
  }

  const provider = resultProvider as ProviderType;
  const config: LLMConfig = { provider, model: '' };

  switch (provider) {
    case 'claude-cli': {
      config.model = 'default';
      if (!isClaudeCliAvailable()) {
        console.log(chalk.yellow('\n  Claude Code CLI not found.'));
        console.log(
          chalk.dim('  Install it: ') +
            chalk.hex('#83D1EB')('npm install -g @anthropic-ai/claude-code'),
        );
        console.log(
          chalk.dim('  Then run ') +
            chalk.hex('#83D1EB')('claude') +
            chalk.dim(' once to log in.\n'),
        );
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      } else if (!isClaudeCliLoggedIn()) {
        console.log(chalk.yellow('\n  Claude Code CLI found but not logged in.'));
        console.log(
          chalk.dim('  Run ') + chalk.hex('#83D1EB')('claude') + chalk.dim(' once to log in.\n'),
        );
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      } else {
        console.log(
          chalk.dim(
            "  Run `claude` once and log in with your Pro/Max/Team account if you haven't.",
          ),
        );
      }
      break;
    }
    case 'opencode': {
      if (!isOpenCodeAvailable()) {
        console.log(chalk.yellow('\n  OpenCode CLI not found.'));
        console.log(chalk.dim('  Install it from: ') + chalk.hex('#83D1EB')('https://opencode.ai'));
        console.log(
          chalk.dim('  Then run ') +
            chalk.hex('#83D1EB')('opencode auth login') +
            chalk.dim(' to authenticate.\n'),
        );
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      } else if (!isOpenCodeLoggedIn()) {
        console.log(chalk.yellow('\n  OpenCode CLI found but not logged in.'));
        console.log(
          chalk.dim('  Run ') +
            chalk.hex('#83D1EB')('opencode auth login') +
            chalk.dim(' to authenticate.\n'),
        );
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      }
      config.model =
        (await promptInput(`Model (default: ${DEFAULT_MODELS.opencode}):`)) ||
        DEFAULT_MODELS.opencode;
      break;
    }
    case 'antigravity': {
      if (!isAntigravityAvailable()) {
        console.log(chalk.yellow('\n  Antigravity CLI (agy) not found on PATH.'));
        console.log(chalk.dim('  Install it: ') + chalk.hex('#83D1EB')('https://goo.gle/agy'));
        console.log(
          chalk.dim('  After install, run ') +
            chalk.hex('#83D1EB')('agy') +
            chalk.dim(' once to authenticate via your Google account.\n'),
        );
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      }

      const defaultProject =
        process.env.ANTIGRAVITY_PROJECT_ID ||
        process.env.VERTEX_PROJECT_ID ||
        process.env.GCP_PROJECT_ID ||
        '';
      config.vertexProjectId =
        (await promptInput(`Antigravity/GCP Project ID (default: ${defaultProject || 'none'}):`)) ||
        defaultProject ||
        undefined;

      const modelChoice = await p.select({
        message: 'Select model',
        options: [
          { label: 'default (Default IDE Model)', value: 'default' },
          { label: 'pro (Gemini Pro)', value: 'pro' },
          { label: 'flash (Gemini Flash)', value: 'flash' },
          { label: 'flash_lite (Gemini Flash Lite)', value: 'flash_lite' },
          { label: 'Custom model name...', value: 'custom' },
        ],
        initialValue: 'default',
      });

      if (p.isCancel(modelChoice)) {
        p.cancel('Cancelled.');
        throw new Error('__exit__');
      }

      if (modelChoice === 'custom') {
        config.model = (await promptInput('Model name (e.g. gemini-2.5-pro):')) || 'default';
      } else {
        config.model = modelChoice as string;
      }
      break;
    }
    case 'cursor': {
      if (!isCursorAgentAvailable()) {
        console.log(chalk.yellow('\n  Cursor Agent CLI not found.'));
        if (IS_WINDOWS) {
          console.log(
            chalk.dim('  Install it from: ') +
              chalk.hex('#83D1EB')('https://www.cursor.com/downloads'),
          );
          console.log(
            chalk.dim('  Then run ') +
              chalk.hex('#83D1EB')('agent login') +
              chalk.dim(' in PowerShell to authenticate.\n'),
          );
        } else {
          console.log(
            chalk.dim('  Install it: ') +
              chalk.hex('#83D1EB')('curl https://cursor.com/install -fsS | bash'),
          );
          console.log(
            chalk.dim('  Then run ') +
              chalk.hex('#83D1EB')('agent login') +
              chalk.dim(' to authenticate.\n'),
          );
        }
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      } else if (!isCursorLoggedIn()) {
        console.log(chalk.yellow('\n  Cursor Agent CLI found but not logged in.'));
        console.log(
          chalk.dim('  Run ') +
            chalk.hex('#83D1EB')('agent login') +
            chalk.dim(' to authenticate.\n'),
        );
        const proceed = await p.confirm({ message: 'Continue anyway?' });
        if (p.isCancel(proceed) || !proceed) throw new Error('__exit__');
      }
      let cursorModels: string[] = [];
      try {
        cursorModels = await listCursorModels();
      } catch {
        // listing unavailable — fall through to free-text
      }
      if (cursorModels.length > 0) {
        const resultModel = await p.select({
          message: 'Select model',
          options: cursorModels.map((m) => ({ label: m, value: m })),
          initialValue: DEFAULT_MODELS.cursor,
        });
        if (p.isCancel(resultModel)) {
          p.cancel('Cancelled.');
          throw new Error('__exit__');
        }
        config.model = resultModel as string;
      } else {
        config.model =
          (await promptInput(`Model (default: ${DEFAULT_MODELS.cursor}):`)) ||
          DEFAULT_MODELS.cursor;
      }
      break;
    }
    case 'anthropic': {
      console.log(
        chalk.dim(
          '  Get a key at https://console.anthropic.com (same account as Claude Pro/Team/Max).',
        ),
      );
      config.apiKey = await promptInput('Anthropic API key:');
      if (!config.apiKey) {
        console.log(chalk.red('API key is required.'));
        throw new Error('__exit__');
      }
      config.model =
        (await promptInput(`Model (default: ${DEFAULT_MODELS.anthropic}):`)) ||
        DEFAULT_MODELS.anthropic;
      break;
    }
    case 'vertex': {
      config.vertexProjectId = await promptInput('GCP Project ID:');
      if (!config.vertexProjectId) {
        console.log(chalk.red('Project ID is required.'));
        throw new Error('__exit__');
      }
      config.vertexRegion = (await promptInput('Region (default: us-east5):')) || 'us-east5';
      config.vertexCredentials =
        (await promptInput('Service account credentials JSON (or leave empty for ADC):')) ||
        undefined;
      config.model =
        (await promptInput(`Model (default: ${DEFAULT_MODELS.vertex}):`)) || DEFAULT_MODELS.vertex;
      break;
    }
    case 'openai': {
      config.apiKey = await promptInput('API key:');
      if (!config.apiKey) {
        console.log(chalk.red('API key is required.'));
        throw new Error('__exit__');
      }
      config.baseUrl =
        (await promptInput('Base URL (leave empty for OpenAI, or enter custom endpoint):')) ||
        undefined;
      config.model =
        (await promptInput(`Model (default: ${DEFAULT_MODELS.openai}):`)) || DEFAULT_MODELS.openai;
      break;
    }
    case 'minimax': {
      console.log(chalk.dim('  Get a key at https://platform.minimax.io'));
      config.apiKey = await promptInput('MiniMax API key:');
      if (!config.apiKey) {
        console.log(chalk.red('API key is required.'));
        throw new Error('__exit__');
      }
      config.model =
        (await promptInput(`Model (default: ${DEFAULT_MODELS.minimax}):`)) ||
        DEFAULT_MODELS.minimax;
      break;
    }
  }

  writeConfigFile(config);

  if (provider === 'cursor') {
    const shim = ensureBashShim();
    if (shim?.created) {
      console.log(
        chalk.dim('\n  Created bash shim at ') +
          chalk.hex('#83D1EB')(shim.path) +
          chalk.dim(' so `agent` works in Git Bash / MINGW.'),
      );
      console.log(chalk.dim('  Restart your terminal for the change to take effect.\n'));
    }
  }

  return config;
}
