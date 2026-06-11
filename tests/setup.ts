import { vi } from 'vitest';

vi.mock('../src/llm/index.js', () => ({
  loadConfig: vi
    .fn()
    .mockReturnValue({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'test-key' }),
  getProvider: vi.fn().mockReturnValue({
    call: vi.fn().mockResolvedValue('{}'),
    stream: vi.fn(),
  }),
  llmCall: vi.fn().mockResolvedValue('{}'),
  llmJsonCall: vi.fn().mockResolvedValue({}),
}));
