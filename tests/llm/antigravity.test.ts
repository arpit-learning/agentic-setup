import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMConfig } from '../../src/llm/types.js';

const spawnMock = vi.fn();
const execSyncMock = vi.fn();

vi.mock('node:child_process', () => {
  return {
    spawn: (...args: unknown[]) => spawnMock(...args),
    execSync: (...args: unknown[]) => execSyncMock(...args),
  };
});

vi.mock('../../src/llm/usage.js', () => ({
  trackUsage: vi.fn(),
}));

describe('AntigravityProvider', () => {
  const config: LLMConfig = {
    provider: 'antigravity',
    model: 'default',
  };

  beforeEach(() => {
    spawnMock.mockClear();
    execSyncMock.mockClear();
    delete process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS;
    delete process.env.AGENTIC_SETUP_ANTIGRAVITY_PRINT_TIMEOUT;
  });

  afterEach(() => {
    delete process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS;
    delete process.env.AGENTIC_SETUP_ANTIGRAVITY_PRINT_TIMEOUT;
  });

  it('checks availability of antigravity command', async () => {
    const { isAntigravityAvailable } = await import('../../src/llm/antigravity.js');
    execSyncMock.mockReturnValue(Buffer.from(''));
    const avail = isAntigravityAvailable();
    expect(avail).toBe(true);
    expect(execSyncMock).toHaveBeenCalled();
  });

  it('checks logged in status', async () => {
    const { isAntigravityLoggedIn } = await import('../../src/llm/antigravity.js');
    execSyncMock.mockReturnValue(Buffer.from(''));
    const loggedIn = isAntigravityLoggedIn();
    expect(loggedIn).toBe(true);
    expect(execSyncMock).toHaveBeenCalled();
  });

  it('uses default timeout when env var is unset', async () => {
    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    expect(provider['timeoutMs']).toBe(10 * 60 * 1000);
    expect(provider['printTimeout']).toBe('8m');
  });

  it('honors AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS', async () => {
    process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS = '300000'; // 5 minutes
    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    expect(provider['timeoutMs']).toBe(300000);
    expect(provider['printTimeout']).toBe('3m'); // 5m - 2m = 3m
  });

  it('honors AGENTIC_SETUP_ANTIGRAVITY_PRINT_TIMEOUT', async () => {
    process.env.AGENTIC_SETUP_ANTIGRAVITY_PRINT_TIMEOUT = '15m';
    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    expect(provider['printTimeout']).toBe('15m');
  });

  it('passes --dangerously-skip-permissions to spawn in call', async () => {
    let spawnArgs: string[] = [];
    spawnMock.mockImplementation((bin: string, args?: string[] | object) => {
      if (Array.isArray(args)) {
        spawnArgs = args;
      } else if (typeof bin === 'string') {
        spawnArgs = bin.split(' ');
      }
      return {
        stdout: {
          on: vi.fn((ev: string, fn: (c: Buffer) => void) => {
            if (ev === 'data') setTimeout(() => fn(Buffer.from('{"response": "test response"}')), 0);
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((ev: string, fn: (code: number) => void) => {
          if (ev === 'close') setTimeout(() => fn(0), 10);
        }),
      };
    });

    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    const result = await provider.call({ prompt: 'test prompt' });
    expect(result).toBe('{"response": "test response"}');
    expect(spawnArgs).toContain('--dangerously-skip-permissions');
    expect(spawnArgs).toContain('--print');
  });

  it('passes --dangerously-skip-permissions to spawn in stream', async () => {
    let spawnArgs: string[] = [];
    spawnMock.mockImplementation((bin: string, args?: string[] | object) => {
      if (Array.isArray(args)) {
        spawnArgs = args;
      } else if (typeof bin === 'string') {
        spawnArgs = bin.split(' ');
      }
      return {
        stdout: {
          on: vi.fn((ev: string, fn: (c: Buffer) => void) => {
            if (ev === 'data') setTimeout(() => fn(Buffer.from('streamed content')), 0);
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((ev: string, fn: (code: number) => void) => {
          if (ev === 'close') setTimeout(() => fn(0), 10);
        }),
      };
    });

    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    let receivedText = '';
    await provider.stream(
      { prompt: 'test prompt' },
      {
        onText: (text) => {
          receivedText += text;
        },
        onEnd: () => {},
        onError: () => {},
      },
    );
    expect(receivedText).toBe('streamed content');
    expect(spawnArgs).toContain('--dangerously-skip-permissions');
    expect(spawnArgs).toContain('--print');
  });

  it('requests JSON output format in the prompt', async () => {
    let spawnArgs: string[] = [];
    spawnMock.mockImplementation((bin: string, args?: string[] | object) => {
      if (Array.isArray(args)) {
        spawnArgs = args;
      }
      return {
        stdout: {
          on: vi.fn((ev: string, fn: (c: Buffer) => void) => {
            if (ev === 'data') setTimeout(() => fn(Buffer.from('{"key": "value"}')), 0);
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((ev: string, fn: (code: number) => void) => {
          if (ev === 'close') setTimeout(() => fn(0), 10);
        }),
      };
    });

    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    await provider.call({ prompt: 'test prompt' });
    const promptArg = spawnArgs[spawnArgs.length - 1];
    expect(promptArg).toContain('JSON');
    expect(promptArg).toContain('RESPOND WITH A VALID JSON BLOCK');
  });
});

