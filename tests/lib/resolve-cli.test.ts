import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveCliBinary,
  isNpxResolution,
  resetResolvedCliBinary,
  isCliCommand,
  pickExecutable,
  displayProductName,
} from '../../src/lib/resolve-cli.js';
import { execSync } from 'child_process';

function withPlatform(platform: NodeJS.Platform, fn: () => void): void {
  const original = process.platform;
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  try {
    fn();
  } finally {
    Object.defineProperty(process, 'platform', { value: original, configurable: true });
  }
}

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, default: { ...actual, existsSync: vi.fn(() => false) } };
});

const mockedExecSync = vi.mocked(execSync);

describe('resolveCliBinary', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    resetResolvedCliBinary();
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns bare npx command when argv[1] contains _npx and agentic-setup/npx not on PATH', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc123/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    const result = resolveCliBinary();
    expect(result).toBe('npx --yes agentic-setup');
  });

  it('returns absolute npx path when in npx context and npx is on PATH but agentic-setup is not', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc123/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('which agentic-setup') || cmd.includes('where agentic-setup'))
        throw new Error('not found');
      if (cmd.includes('which npx') || cmd.includes('where npx')) return '/opt/homebrew/bin/npx\n';
      throw new Error('unexpected');
    });
    const result = resolveCliBinary();
    expect(result).toBe('/opt/homebrew/bin/npx --yes agentic-setup');
  });

  it('returns absolute agentic-setup path when in npx context but agentic-setup is globally installed', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc123/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('which agentic-setup') || cmd.includes('where agentic-setup'))
        return '/opt/homebrew/bin/agentic-setup\n';
      throw new Error('unexpected');
    });
    const result = resolveCliBinary();
    expect(result).toBe('/opt/homebrew/bin/agentic-setup');
  });

  it('returns npx command when npm_execpath contains npx and agentic-setup/npx not on PATH', () => {
    process.argv[1] = '/some/path/agentic-setup';
    process.env.npm_execpath = '/usr/local/lib/node_modules/npm/bin/npx-cli.js';
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    const result = resolveCliBinary();
    expect(result).toBe('npx --yes agentic-setup');
  });

  it('returns absolute path when agentic-setup is found on PATH', () => {
    process.argv[1] = '/usr/local/bin/agentic-setup';
    delete process.env.npm_execpath;
    mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');
    const result = resolveCliBinary();
    expect(result).toBe('/usr/local/bin/agentic-setup');
  });

  it('caches the result across calls', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    resolveCliBinary();
    process.argv[1] = '/usr/local/bin/agentic-setup';
    expect(resolveCliBinary()).toBe('npx --yes agentic-setup');
  });

  it('resetResolvedCliBinary clears the cache', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(resolveCliBinary()).toBe('npx --yes agentic-setup');

    resetResolvedCliBinary();
    process.argv[1] = '/usr/local/bin/agentic-setup';
    delete process.env.npm_execpath;
    mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');
    expect(resolveCliBinary()).toBe('/usr/local/bin/agentic-setup');
  });
});

describe('isNpxResolution', () => {
  beforeEach(() => {
    resetResolvedCliBinary();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when resolved to bare npx', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(isNpxResolution()).toBe(true);
  });

  it('returns true when resolved to absolute-path npx', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('which agentic-setup') || cmd.includes('where agentic-setup'))
        throw new Error('not found');
      if (cmd.includes('which npx') || cmd.includes('where npx')) return '/opt/homebrew/bin/npx\n';
      throw new Error('unexpected');
    });
    expect(isNpxResolution()).toBe(true);
  });

  it('returns false when resolved to absolute agentic-setup path', () => {
    process.argv[1] = '/usr/local/bin/agentic-setup';
    delete process.env.npm_execpath;
    mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');
    expect(isNpxResolution()).toBe(false);
  });
});

describe('pickExecutable', () => {
  it('returns the first line on POSIX', () => {
    withPlatform('linux', () => {
      expect(pickExecutable('/usr/local/bin/agentic-setup\n/opt/bin/agentic-setup')).toBe(
        '/usr/local/bin/agentic-setup',
      );
    });
  });

  it('prefers .cmd over the POSIX shim on Windows', () => {
    withPlatform('win32', () => {
      const out =
        'C:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup\nC:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup.cmd';
      expect(pickExecutable(out)).toBe('C:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup.cmd');
    });
  });

  it('prefers .exe / .bat over extensionless on Windows', () => {
    withPlatform('win32', () => {
      expect(pickExecutable('C:\\bin\\foo\nC:\\bin\\foo.exe')).toBe('C:\\bin\\foo.exe');
      expect(pickExecutable('C:\\bin\\foo\nC:\\bin\\foo.bat')).toBe('C:\\bin\\foo.bat');
    });
  });

  it('falls back to first line on Windows when no .cmd/.exe/.bat present', () => {
    withPlatform('win32', () => {
      expect(pickExecutable('C:\\bin\\foo\nC:\\bin\\bar')).toBe('C:\\bin\\foo');
    });
  });

  it('returns empty string for empty input', () => {
    expect(pickExecutable('')).toBe('');
    expect(pickExecutable('\n\n')).toBe('');
  });

  it('handles CRLF line endings from Windows `where`', () => {
    withPlatform('win32', () => {
      expect(pickExecutable('C:\\bin\\foo\r\nC:\\bin\\foo.cmd\r\n')).toBe('C:\\bin\\foo.cmd');
    });
  });

  it('matches the extension only — not `cmd` substrings in directory names', () => {
    withPlatform('win32', () => {
      expect(pickExecutable('C:\\cmd-tools\\bin\\agentic-setup')).toBe(
        'C:\\cmd-tools\\bin\\agentic-setup',
      );
      expect(
        pickExecutable('C:\\cmd-tools\\bin\\agentic-setup\nC:\\cmd-tools\\bin\\agentic-setup.cmd'),
      ).toBe('C:\\cmd-tools\\bin\\agentic-setup.cmd');
    });
  });
});

describe('resolveCliBinary on Windows', () => {
  beforeEach(() => {
    resetResolvedCliBinary();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects agentic-setup.cmd over the POSIX shim', () => {
    withPlatform('win32', () => {
      process.argv[1] = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue(
        'C:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup\nC:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup.cmd\n',
      );
      expect(resolveCliBinary()).toBe('C:\\Users\\dev\\AppData\\Roaming\\npm\\agentic-setup.cmd');
    });
  });

  it('selects npx.cmd over the POSIX shim in npx context', () => {
    withPlatform('win32', () => {
      process.argv[1] =
        'C:\\Users\\dev\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\.bin\\agentic-setup';
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('where agentic-setup')) throw new Error('not found');
        if (cmd.includes('where npx'))
          return 'C:\\Users\\dev\\AppData\\Roaming\\npm\\npx\nC:\\Users\\dev\\AppData\\Roaming\\npm\\npx.cmd\n';
        throw new Error('unexpected');
      });
      const result = resolveCliBinary();
      expect(result).toBe('C:\\Users\\dev\\AppData\\Roaming\\npm\\npx.cmd --yes agentic-setup');
      expect(isNpxResolution()).toBe(true);
    });
  });
});

describe('isCliCommand', () => {
  it('matches bare agentic-setup with subcommand', () => {
    expect(isCliCommand('agentic-setup refresh --quiet', 'refresh --quiet')).toBe(true);
  });

  it('matches absolute path', () => {
    expect(isCliCommand('/usr/local/bin/agentic-setup refresh --quiet', 'refresh --quiet')).toBe(
      true,
    );
  });

  it('matches npx --yes form', () => {
    expect(isCliCommand('npx --yes agentic-setup refresh --quiet', 'refresh --quiet')).toBe(true);
  });

  it('matches npx without --yes', () => {
    expect(isCliCommand('npx agentic-setup refresh --quiet', 'refresh --quiet')).toBe(true);
  });

  it('does not match unrelated commands', () => {
    expect(isCliCommand('npm run refresh --quiet', 'refresh --quiet')).toBe(false);
  });
});

describe('displayProductName (F-P0-3)', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    resetResolvedCliBinary();
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    resetResolvedCliBinary();
    vi.restoreAllMocks();
  });

  it('returns "agentic-setup" for global install (no npx)', () => {
    process.argv[1] = '/usr/local/bin/agentic-setup';
    delete process.env.npm_execpath;
    mockedExecSync.mockReturnValue('/Users/someone/.nvm/versions/node/v20/bin/agentic-setup\n');
    expect(displayProductName()).toBe('agentic-setup');
  });

  it('returns "npx agentic-setup" when npx resolution is used', () => {
    process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(displayProductName()).toBe('npx agentic-setup');
  });

  it('does NOT return an absolute path even when agentic-setup resolves to one', () => {
    process.argv[1] = '/usr/local/bin/agentic-setup';
    delete process.env.npm_execpath;
    mockedExecSync.mockReturnValue('/Users/someone/.nvm/versions/node/v20/bin/agentic-setup\n');
    const display = displayProductName();
    expect(display).not.toMatch(/^\//);
    expect(display).not.toContain('.nvm');
    expect(display).not.toContain('Users');
  });
});
