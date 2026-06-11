import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMConfig } from '../../src/llm/types.js';

const openAIConstructor = vi.fn();

vi.mock('openai', () => {
  class OpenAI {
    chat = { completions: { create: vi.fn() } };
    models = { list: vi.fn() };
    constructor(opts: unknown) {
      openAIConstructor(opts);
    }
  }
  return { default: OpenAI };
});

vi.mock('../../src/llm/usage.js', () => ({
  trackUsage: vi.fn(),
}));

describe('OpenAICompatProvider — AGENTIC_SETUP_OPENAI_TIMEOUT_MS', () => {
  const config: LLMConfig = {
    provider: 'openai',
    apiKey: 'sk-test',
    baseUrl: 'http://localhost:11434/v1',
    model: 'gpt-4o',
  };

  beforeEach(() => {
    openAIConstructor.mockClear();
    delete process.env.AGENTIC_SETUP_OPENAI_TIMEOUT_MS;
  });

  afterEach(() => {
    delete process.env.AGENTIC_SETUP_OPENAI_TIMEOUT_MS;
  });

  it('uses the default 10-minute timeout when env var is unset', async () => {
    const { OpenAICompatProvider } = await import('../../src/llm/openai-compat.js');
    new OpenAICompatProvider(config);
    expect(openAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10 * 60 * 1000 }),
    );
  });

  it('honors AGENTIC_SETUP_OPENAI_TIMEOUT_MS when set', async () => {
    process.env.AGENTIC_SETUP_OPENAI_TIMEOUT_MS = '1800000';
    const { OpenAICompatProvider } = await import('../../src/llm/openai-compat.js');
    new OpenAICompatProvider(config);
    expect(openAIConstructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 1800000 }));
  });

  it('falls back to default when env var is non-numeric', async () => {
    process.env.AGENTIC_SETUP_OPENAI_TIMEOUT_MS = 'forever';
    const { OpenAICompatProvider } = await import('../../src/llm/openai-compat.js');
    new OpenAICompatProvider(config);
    expect(openAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10 * 60 * 1000 }),
    );
  });

  it('falls back to default when env var is below 1000ms', async () => {
    process.env.AGENTIC_SETUP_OPENAI_TIMEOUT_MS = '500';
    const { OpenAICompatProvider } = await import('../../src/llm/openai-compat.js');
    new OpenAICompatProvider(config);
    expect(openAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10 * 60 * 1000 }),
    );
  });
});
