import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('os', () => ({ default: { homedir: () => '/home/user' } }));
vi.mock('../../src/llm/config.js');
vi.mock('../../src/llm/cursor-acp.js');
vi.mock('../../src/llm/claude-cli.js');
vi.mock('../../src/llm/opencode.js');
vi.mock('../../src/llm/antigravity.js');

import { validateLlmSetup } from '../../src/llm/preflight.js';
import * as config from '../../src/llm/config.js';
import * as cursorAcp from '../../src/llm/cursor-acp.js';
import * as claudeCli from '../../src/llm/claude-cli.js';
import * as opencode from '../../src/llm/opencode.js';
import * as antigravity from '../../src/llm/antigravity.js';

const originalEnv = process.env;

describe('preflight validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Clear all env vars that might affect validation
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    delete process.env.VERTEX_PROJECT_ID;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.AGENTIC_SETUP_USE_CURSOR_SEAT;
    delete process.env.AGENTIC_SETUP_USE_CLAUDE_CLI;
    delete process.env.AGENTIC_SETUP_USE_OPENCODE;
    delete process.env.VERTEX_SA_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('File not found');
    });

    vi.mocked(config.loadConfig).mockReturnValue(null);
    vi.mocked(cursorAcp.isCursorAgentAvailable).mockReturnValue(false);
    vi.mocked(cursorAcp.isCursorLoggedIn).mockReturnValue(false);
    vi.mocked(claudeCli.isClaudeCliAvailable).mockReturnValue(false);
    vi.mocked(claudeCli.isClaudeCliLoggedIn).mockReturnValue(false);
    vi.mocked(opencode.isOpenCodeAvailable).mockReturnValue(false);
    vi.mocked(opencode.isOpenCodeLoggedIn).mockReturnValue(false);
    vi.mocked(antigravity.isAntigravityAvailable).mockReturnValue(false);
    vi.mocked(antigravity.isAntigravityLoggedIn).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateLlmSetup', () => {
    it('should return error when no provider is configured', () => {
      const result = validateLlmSetup();
      expect(result.ok).toBe(false);
      expect(result.provider).toBe('anthropic');
      expect(result.error).toContain('No LLM Provider Configured');
    });

    describe('Anthropic provider', () => {
      it('should return error when API key is missing', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('anthropic');
        expect(result.error).toContain('Missing Anthropic API Key');
      });

      it('should return error when API key format is invalid', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          apiKey: 'invalid-key-format',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('anthropic');
        expect(result.error).toContain('Invalid Anthropic API Key Format');
      });

      it('should pass validation with valid API key', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          apiKey: 'sk-ant-valid-key-here',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });

    describe('OpenAI provider', () => {
      it('should return error when API key is missing', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'openai',
          model: 'gpt-5.4-mini',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('openai');
        expect(result.error).toContain('Missing OpenAI API Key');
      });

      it('should return error when API key format is invalid', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'openai',
          model: 'gpt-5.4-mini',
          apiKey: 'invalid-key',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('openai');
        expect(result.error).toContain('Invalid OpenAI API Key Format');
      });

      it('should pass validation with valid API key', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'openai',
          model: 'gpt-5.4-mini',
          apiKey: 'sk-valid-openai-key',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });

    describe('Vertex provider', () => {
      it('should return error when project ID is missing', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'vertex',
          model: 'claude-sonnet-4-6',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('vertex');
        expect(result.error).toContain('Missing Vertex AI Project ID');
      });

      it('should return error when credentials JSON is invalid', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'vertex',
          model: 'claude-sonnet-4-6',
          vertexProjectId: 'my-project',
          vertexCredentials: '{invalid json}',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('vertex');
        expect(result.error).toContain('Invalid Vertex Credentials JSON');
      });

      it('should return error when credentials file not found', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'vertex',
          model: 'claude-sonnet-4-6',
          vertexProjectId: 'my-project',
          vertexCredentials: '/path/to/nonexistent/file.json',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('vertex');
        expect(result.error).toContain('Vertex Credentials File Not Found');
      });

      it('should pass validation with valid project ID only', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'vertex',
          model: 'claude-sonnet-4-6',
          vertexProjectId: 'my-project',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });

      it('should pass validation with valid credentials JSON', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'vertex',
          model: 'claude-sonnet-4-6',
          vertexProjectId: 'my-project',
          vertexCredentials: '{"type":"service_account","project_id":"test"}',
        });

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });

    describe('Cursor provider', () => {
      it('should return error when CLI is not available', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'cursor',
          model: 'auto',
        });
        vi.mocked(cursorAcp.isCursorAgentAvailable).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('cursor');
        expect(result.error).toContain('Cursor Agent CLI Not Installed');
      });

      it('should return error when CLI is not logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'cursor',
          model: 'auto',
        });
        vi.mocked(cursorAcp.isCursorAgentAvailable).mockReturnValue(true);
        vi.mocked(cursorAcp.isCursorLoggedIn).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('cursor');
        expect(result.error).toContain('Cursor Agent CLI Not Logged In');
      });

      it('should pass validation when CLI is available and logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'cursor',
          model: 'auto',
        });
        vi.mocked(cursorAcp.isCursorAgentAvailable).mockReturnValue(true);
        vi.mocked(cursorAcp.isCursorLoggedIn).mockReturnValue(true);

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });

    describe('Claude CLI provider', () => {
      it('should return error when CLI is not available', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'claude-cli',
          model: 'default',
        });
        vi.mocked(claudeCli.isClaudeCliAvailable).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('claude-cli');
        expect(result.error).toContain('Claude Code CLI Not Installed');
      });

      it('should return error when CLI is not logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'claude-cli',
          model: 'default',
        });
        vi.mocked(claudeCli.isClaudeCliAvailable).mockReturnValue(true);
        vi.mocked(claudeCli.isClaudeCliLoggedIn).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('claude-cli');
        expect(result.error).toContain('Claude Code CLI Not Logged In');
      });

      it('should pass validation when CLI is available and logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'claude-cli',
          model: 'default',
        });
        vi.mocked(claudeCli.isClaudeCliAvailable).mockReturnValue(true);
        vi.mocked(claudeCli.isClaudeCliLoggedIn).mockReturnValue(true);

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });

    describe('OpenCode provider', () => {
      it('should return error when CLI is not available', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'opencode',
          model: 'default',
        });
        vi.mocked(opencode.isOpenCodeAvailable).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('opencode');
        expect(result.error).toContain('OpenCode CLI Not Installed');
      });

      it('should return error when CLI is not logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'opencode',
          model: 'default',
        });
        vi.mocked(opencode.isOpenCodeAvailable).mockReturnValue(true);
        vi.mocked(opencode.isOpenCodeLoggedIn).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('opencode');
        expect(result.error).toContain('OpenCode CLI Not Logged In');
      });

      it('should pass validation when CLI is available and logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'opencode',
          model: 'default',
        });
        vi.mocked(opencode.isOpenCodeAvailable).mockReturnValue(true);
        vi.mocked(opencode.isOpenCodeLoggedIn).mockReturnValue(true);

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });

    describe('Antigravity provider', () => {
      it('should return error when CLI is not available', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'antigravity',
          model: 'default',
        });
        vi.mocked(antigravity.isAntigravityAvailable).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('antigravity');
        expect(result.error).toContain('Antigravity CLI (agentapi) Not Installed');
      });

      it('should return error when CLI is not logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'antigravity',
          model: 'default',
        });
        vi.mocked(antigravity.isAntigravityAvailable).mockReturnValue(true);
        vi.mocked(antigravity.isAntigravityLoggedIn).mockReturnValue(false);

        const result = validateLlmSetup();
        expect(result.ok).toBe(false);
        expect(result.provider).toBe('antigravity');
        expect(result.error).toContain('Antigravity CLI Not Authenticated');
      });

      it('should pass validation when CLI is available and logged in', () => {
        vi.mocked(config.loadConfig).mockReturnValue({
          provider: 'antigravity',
          model: 'default',
        });
        vi.mocked(antigravity.isAntigravityAvailable).mockReturnValue(true);
        vi.mocked(antigravity.isAntigravityLoggedIn).mockReturnValue(true);

        const result = validateLlmSetup();
        expect(result.ok).toBe(true);
      });
    });
  });

  describe('recovery options', () => {
    it('should include appropriate recovery options in error', () => {
      vi.mocked(config.loadConfig).mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
      });

      const result = validateLlmSetup();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.recoveryOptions).toBeDefined();
        expect(result.recoveryOptions.length).toBeGreaterThan(0);
        expect(result.recoveryOptions.some((o) => o.action === 'fix-now')).toBe(true);
        expect(result.recoveryOptions.some((o) => o.action === 'skip')).toBe(true);
      }
    });
  });
});
