import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// These tests verify that agentic-setup hook commands exit immediately when
// AGENTIC_SETUP_SUBPROCESS=1 or AGENTIC_SETUP_SPAWNED is set.

describe('spawned-session guard (AGENTIC_SETUP_SUBPROCESS=1)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    delete process.env.CLAUDECODE;
    delete process.env.AGENTIC_SETUP_SUBPROCESS;
    delete process.env.AGENTIC_SETUP_SPAWNED;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('refreshCommand (quiet mode)', () => {
    it('returns immediately without calling isAgenticSetupRunning when AGENTIC_SETUP_SUBPROCESS=1', async () => {
      process.env.AGENTIC_SETUP_SUBPROCESS = '1';

      const lockMock = { isAgenticSetupRunning: vi.fn().mockReturnValue(false) };
      vi.doMock('../../src/lib/lock.js', () => lockMock);

      const { refreshCommand } = await import('../../src/commands/refresh.js');
      await expect(refreshCommand({ quiet: true })).resolves.toBeUndefined();
      expect(lockMock.isAgenticSetupRunning).not.toHaveBeenCalled();
    });

    it('proceeds normally when subprocess sentinel is not set', async () => {
      const lockMock = { isAgenticSetupRunning: vi.fn().mockReturnValue(true) };
      vi.doMock('../../src/lib/lock.js', () => lockMock);

      const { refreshCommand } = await import('../../src/commands/refresh.js');
      await expect(refreshCommand({ quiet: true })).resolves.toBeUndefined();
      expect(lockMock.isAgenticSetupRunning).toHaveBeenCalled();
    });

    it('short-circuits when AGENTIC_SETUP_SPAWNED is set', async () => {
      process.env.AGENTIC_SETUP_SPAWNED = '1';

      const lockMock = { isAgenticSetupRunning: vi.fn().mockReturnValue(true) };
      vi.doMock('../../src/lib/lock.js', () => lockMock);

      const { refreshCommand } = await import('../../src/commands/refresh.js');
      await expect(refreshCommand({ quiet: true })).resolves.toBeUndefined();
      expect(lockMock.isAgenticSetupRunning).not.toHaveBeenCalled();
    });
  });

  describe('learnFinalizeCommand (auto mode)', () => {
    it('returns immediately without doing any work when AGENTIC_SETUP_SUBPROCESS=1', async () => {
      process.env.AGENTIC_SETUP_SUBPROCESS = '1';

      const lockMock = { isAgenticSetupRunning: vi.fn(), acquireFinalizeLock: vi.fn() };
      vi.doMock('../../src/lib/lock.js', () => lockMock);

      const { learnFinalizeCommand } = await import('../../src/commands/learn.js');
      await expect(learnFinalizeCommand({ auto: true })).resolves.toBeUndefined();
      expect(lockMock.isAgenticSetupRunning).not.toHaveBeenCalled();
    });

    it('proceeds normally when subprocess sentinel is not set', async () => {
      const storageMock = {
        acquireFinalizeLock: vi.fn().mockReturnValue(false),
        releaseFinalizeLock: vi.fn(),
        readAllEvents: vi.fn().mockReturnValue([]),
        readState: vi.fn().mockReturnValue({ eventCount: 0 }),
        writeState: vi.fn(),
        clearSession: vi.fn(),
        resetState: vi.fn(),
        getEventCount: vi.fn().mockReturnValue(0),
        appendEvent: vi.fn(),
        appendPromptEvent: vi.fn(),
      };
      vi.doMock('../../src/learner/storage.js', () => storageMock);

      const { learnFinalizeCommand } = await import('../../src/commands/learn.js');
      await expect(learnFinalizeCommand({ auto: true })).resolves.toBeUndefined();
      expect(storageMock.acquireFinalizeLock).toHaveBeenCalled();
    });
  });

  describe('learnObserveCommand', () => {
    it('returns immediately when AGENTIC_SETUP_SUBPROCESS=1', async () => {
      process.env.AGENTIC_SETUP_SUBPROCESS = '1';

      const { learnObserveCommand } = await import('../../src/commands/learn.js');
      await expect(learnObserveCommand({})).resolves.toBeUndefined();
    });
  });
});
