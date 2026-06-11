import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// F-P0-9: learn finalize must skip silently when fired from a SessionEnd hook
// inside a user-initiated `claude -p` session (CLAUDECODE=1 + !AGENTIC_SETUP_SUBPROCESS).
// Otherwise the hook spawns another claude -p for the LLM call, which Claude Code's
// hook timeout cancels mid-cascade — producing visible "Hook cancelled" stderr noise.

describe('learn finalize hook-cascade short-circuit (F-P0-9)', () => {
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

  it('skips when --auto AND inside user-initiated Claude Code session', async () => {
    process.env.CLAUDECODE = '1';
    delete process.env.AGENTIC_SETUP_SUBPROCESS;

    const lockMock = { isAgenticSetupRunning: vi.fn(), acquireFinalizeLock: vi.fn() };
    vi.doMock('../../src/lib/lock.js', () => lockMock);

    const { learnFinalizeCommand } = await import('../../src/commands/learn.js');
    await expect(learnFinalizeCommand({ auto: true })).resolves.toBeUndefined();
    // The cascade short-circuit fires before any lock check.
    expect(lockMock.isAgenticSetupRunning).not.toHaveBeenCalled();
  });

  it('proceeds (does not short-circuit on cascade) when --auto + agentic-spawned', async () => {
    process.env.CLAUDECODE = '1';
    process.env.AGENTIC_SETUP_SUBPROCESS = '1';
    // AGENTIC_SETUP_SUBPROCESS=1 path: existing isAgenticSetupSubprocess() guard fires first
    // (covered by spawned-session-guard.test.ts). The new cascade check only
    // fires when AGENTIC_SETUP_SUBPROCESS is NOT set. This test asserts no crash.
    const { learnFinalizeCommand } = await import('../../src/commands/learn.js');
    await expect(learnFinalizeCommand({ auto: true })).resolves.toBeUndefined();
  });

  it('proceeds when --auto but no CLAUDECODE (e.g. pre-commit hook)', async () => {
    delete process.env.CLAUDECODE;
    delete process.env.AGENTIC_SETUP_SUBPROCESS;
    // Refresh proceeds past the cascade short-circuit. Will return undefined
    // eventually for other reasons (no events to analyze, etc.) — test asserts no throw.
    const { learnFinalizeCommand } = await import('../../src/commands/learn.js');
    await expect(learnFinalizeCommand({ auto: true })).resolves.toBeUndefined();
  });

  it('proceeds (no cascade short-circuit) when CLAUDECODE=1 but NOT --auto', async () => {
    process.env.CLAUDECODE = '1';
    delete process.env.AGENTIC_SETUP_SUBPROCESS;
    // The cascade check is gated on isAuto. A user manually running
    // `agentic-setup learn finalize` from an interactive Claude Code terminal
    // should still work normally.
    const { learnFinalizeCommand } = await import('../../src/commands/learn.js');
    await expect(learnFinalizeCommand({})).resolves.toBeUndefined();
  });
});
