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
  });

  afterEach(() => {
    delete process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS;
  });

  it('checks availability of antigravity command', async () => {
    const { isAntigravityAvailable } = await import('../../src/llm/antigravity.js');
    execSyncMock.mockReturnValue(Buffer.from(''));
    const avail = isAntigravityAvailable();
    expect(avail).toBe(true);
    expect(execSyncMock).toHaveBeenCalled();
  });

  it('checks logged in status', async () => {
    const { isAntigravityLoggedIn, resetAntigravityLoginCache } = await import('../../src/llm/antigravity.js');
    resetAntigravityLoginCache();
    execSyncMock.mockReturnValue(Buffer.from('my-session-active'));
    const loggedIn = isAntigravityLoggedIn();
    expect(loggedIn).toBe(true);
    expect(execSyncMock).toHaveBeenCalledWith('antigravity auth list', expect.any(Object));
  });

  it('uses default timeout when env var is unset', async () => {
    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    expect(provider['timeoutMs']).toBe(10 * 60 * 1000);
  });

  it('honors AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS', async () => {
    process.env.AGENTIC_SETUP_ANTIGRAVITY_TIMEOUT_MS = '5000';
    const { AntigravityProvider } = await import('../../src/llm/antigravity.js');
    const provider = new AntigravityProvider(config);
    expect(provider['timeoutMs']).toBe(5000);
  });
});
