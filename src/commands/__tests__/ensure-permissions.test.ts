import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('fs');

// ensurePermissions is a private function in init.ts, so we test it indirectly
// by extracting the logic into a testable form. Since it's not exported,
// we replicate the exact logic here and test it as a unit.

function ensurePermissions(): void {
  const settingsPath = '.claude/settings.json';
  let settings: Record<string, unknown> = {};

  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8') as string);
    }
  } catch {
    /* not valid JSON, start fresh */
  }

  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  const allow = permissions.allow as unknown[] | undefined;

  if (Array.isArray(allow) && allow.length > 0) return;

  permissions.allow = ['Bash(npm run *)', 'Bash(npx vitest *)', 'Bash(npx tsc *)', 'Bash(git *)'];
  settings.permissions = permissions;

  if (!fs.existsSync('.claude')) fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

describe('ensurePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes default permissions when no settings file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    ensurePermissions();

    expect(fs.mkdirSync).toHaveBeenCalledWith('.claude', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalled();

    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions.allow).toEqual([
      'Bash(npm run *)',
      'Bash(npx vitest *)',
      'Bash(npx tsc *)',
      'Bash(git *)',
    ]);
  });

  it('does not overwrite when permissions.allow already has entries', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ permissions: { allow: ['Bash(make *)'] } }) as never,
    );

    ensurePermissions();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('adds permissions when file exists but has empty allow array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ permissions: { allow: [] } }) as never,
    );
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    ensurePermissions();

    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions.allow).toHaveLength(4);
  });

  it('adds permissions when file exists but has no permissions field', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ someOtherSetting: true }) as never);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    ensurePermissions();

    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.someOtherSetting).toBe(true);
    expect(written.permissions.allow).toHaveLength(4);
  });

  it('handles invalid JSON gracefully and writes fresh permissions', () => {
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true) // settings file exists
      .mockReturnValueOnce(false); // .claude dir doesn't exist
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json' as never);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    ensurePermissions();

    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
