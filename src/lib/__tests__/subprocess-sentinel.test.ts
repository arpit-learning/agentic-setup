import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AGENTIC_SETUP_SUBPROCESS_ENV,
  AGENTIC_SETUP_SPAWNED_ENV,
  isAgenticSetupSubprocess,
  isHookCascadeFromUserClaudeSession,
  withAgenticSetupSubprocessEnv,
} from '../subprocess-sentinel.js';

describe('subprocess-sentinel', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env[AGENTIC_SETUP_SUBPROCESS_ENV];
    delete process.env[AGENTIC_SETUP_SPAWNED_ENV];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isAgenticSetupSubprocess()', () => {
    it('returns false when sentinel env vars are unset', () => {
      expect(isAgenticSetupSubprocess()).toBe(false);
    });

    it('returns true when AGENTIC_SETUP_SUBPROCESS=1', () => {
      process.env[AGENTIC_SETUP_SUBPROCESS_ENV] = '1';
      expect(isAgenticSetupSubprocess()).toBe(true);
    });

    it('returns true when AGENTIC_SETUP_SPAWNED is set', () => {
      process.env[AGENTIC_SETUP_SPAWNED_ENV] = '1';
      expect(isAgenticSetupSubprocess()).toBe(true);
    });

    it('returns false when AGENTIC_SETUP_SUBPROCESS is set to anything other than "1"', () => {
      process.env[AGENTIC_SETUP_SUBPROCESS_ENV] = 'true';
      expect(isAgenticSetupSubprocess()).toBe(false);
      process.env[AGENTIC_SETUP_SUBPROCESS_ENV] = '0';
      expect(isAgenticSetupSubprocess()).toBe(false);
      process.env[AGENTIC_SETUP_SUBPROCESS_ENV] = '';
      expect(isAgenticSetupSubprocess()).toBe(false);
    });
  });

  describe('withAgenticSetupSubprocessEnv()', () => {
    it('sets AGENTIC_SETUP_SUBPROCESS=1 on the returned env', () => {
      const env = withAgenticSetupSubprocessEnv({ FOO: 'bar' } as NodeJS.ProcessEnv);
      expect(env[AGENTIC_SETUP_SUBPROCESS_ENV]).toBe('1');
    });

    it('also sets AGENTIC_SETUP_SPAWNED=1', () => {
      const env = withAgenticSetupSubprocessEnv({ FOO: 'bar' } as NodeJS.ProcessEnv);
      expect(env[AGENTIC_SETUP_SPAWNED_ENV]).toBe('1');
    });

    it('preserves the input env entries', () => {
      const env = withAgenticSetupSubprocessEnv({ FOO: 'bar', BAZ: 'qux' } as NodeJS.ProcessEnv);
      expect(env.FOO).toBe('bar');
      expect(env.BAZ).toBe('qux');
    });

    it('does not mutate the input env object', () => {
      const input: NodeJS.ProcessEnv = { FOO: 'bar' };
      withAgenticSetupSubprocessEnv(input);
      expect(input).toEqual({ FOO: 'bar' });
      expect(AGENTIC_SETUP_SUBPROCESS_ENV in input).toBe(false);
    });

    it('overrides any existing sentinel values in the input', () => {
      const env = withAgenticSetupSubprocessEnv({
        [AGENTIC_SETUP_SUBPROCESS_ENV]: '0',
        [AGENTIC_SETUP_SPAWNED_ENV]: 'no',
      });
      expect(env[AGENTIC_SETUP_SUBPROCESS_ENV]).toBe('1');
      expect(env[AGENTIC_SETUP_SPAWNED_ENV]).toBe('1');
    });

    it('handles undefined values in the input env (NodeJS.ProcessEnv shape)', () => {
      const input: NodeJS.ProcessEnv = { FOO: undefined, BAR: 'set' };
      const env = withAgenticSetupSubprocessEnv(input);
      expect(env.FOO).toBeUndefined();
      expect(env.BAR).toBe('set');
      expect(env[AGENTIC_SETUP_SUBPROCESS_ENV]).toBe('1');
    });
  });

  describe('isHookCascadeFromUserClaudeSession (F-P0-9)', () => {
    let originalIsTTY: boolean | undefined;

    beforeEach(() => {
      delete process.env.CLAUDECODE;
      delete process.env[AGENTIC_SETUP_SUBPROCESS_ENV];
      delete process.env[AGENTIC_SETUP_SPAWNED_ENV];
      originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    });

    it('returns false when not in any claude session', () => {
      expect(isHookCascadeFromUserClaudeSession()).toBe(false);
    });

    it('returns true when CLAUDECODE=1, no subprocess sentinel, stdin not a TTY', () => {
      process.env.CLAUDECODE = '1';
      expect(isHookCascadeFromUserClaudeSession()).toBe(true);
    });

    it('returns false when in an agentic-spawned claude session', () => {
      process.env.CLAUDECODE = '1';
      process.env[AGENTIC_SETUP_SUBPROCESS_ENV] = '1';
      expect(isHookCascadeFromUserClaudeSession()).toBe(false);
    });

    it('returns false when AGENTIC_SETUP_SUBPROCESS=1 even without CLAUDECODE', () => {
      process.env[AGENTIC_SETUP_SUBPROCESS_ENV] = '1';
      expect(isHookCascadeFromUserClaudeSession()).toBe(false);
    });

    it('returns false when stdin IS a TTY (user manually invoked from terminal inside Claude Code)', () => {
      process.env.CLAUDECODE = '1';
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
      expect(isHookCascadeFromUserClaudeSession()).toBe(false);
    });
  });
});
