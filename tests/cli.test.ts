import { describe, it, expect } from 'vitest';
import { program } from '../src/cli.js';

describe('cli command registration', () => {
  it('registers regenerate as the primary command', () => {
    const cmd = program.commands.find((c) => c.name() === 'regenerate');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Re-analyze project and regenerate config');
  });

  it.each(['regen', 're'])('registers "%s" as an alias for regenerate', (alias) => {
    const cmd = program.commands.find((c) => c.name() === 'regenerate');
    expect(cmd!.aliases()).toContain(alias);
  });

  it('regenerate has --dry-run option', () => {
    const cmd = program.commands.find((c) => c.name() === 'regenerate');
    const opt = cmd!.options.find((o) => o.long === '--dry-run');
    expect(opt).toBeDefined();
  });

  it('registers all expected top-level commands', () => {
    const names = program.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining([
        'init',
        'undo',
        'status',
        'regenerate',
        'config',
        'score',
        'refresh',
        'hooks',
        'learn',
        'setup',
        'check',
        'ci',
        'skills',
      ]),
    );
  });

  it('does not register removed bootstrap command', () => {
    const names = program.commands.map((c) => c.name());
    expect(names).not.toContain('bootstrap');
  });

  it('registers --print-timeout as a global option', () => {
    const opt = program.options.find((o) => o.long === '--print-timeout');
    expect(opt).toBeDefined();
    expect(opt!.description).toContain('Antigravity provider');
  });

  it('registers --dangerously-skip-permissions on init command', () => {
    const cmd = program.commands.find((c) => c.name() === 'init');
    const opt = cmd!.options.find((o) => o.long === '--dangerously-skip-permissions');
    expect(opt).toBeDefined();
  });

  it('registers --dangerously-skip-permissions on setup command', () => {
    const cmd = program.commands.find((c) => c.name() === 'setup');
    const opt = cmd!.options.find((o) => o.long === '--dangerously-skip-permissions');
    expect(opt).toBeDefined();
  });
});
