import { describe, it, expect } from 'vitest';
import { quoteForWindows, bashPath } from '../../src/utils/windows.js';

describe('quoteForWindows', () => {
  it('returns "" for empty input', () => {
    expect(quoteForWindows('')).toBe('""');
  });

  it('returns input unchanged when no whitespace or quotes', () => {
    expect(quoteForWindows('simple')).toBe('simple');
    expect(quoteForWindows('C:/Users/foo')).toBe('C:/Users/foo');
  });

  it('wraps in double quotes when whitespace is present', () => {
    expect(quoteForWindows('a b')).toBe('"a b"');
    expect(quoteForWindows('C:\\Program Files\\agentic-setup.cmd')).toBe(
      '"C:\\Program Files\\agentic-setup.cmd"',
    );
  });

  it('escapes embedded double quotes', () => {
    expect(quoteForWindows('say "hi"')).toBe('"say \\"hi\\""');
  });
});

describe('bashPath', () => {
  it('returns POSIX paths unchanged', () => {
    expect(bashPath('/usr/local/bin/agentic-setup')).toBe('/usr/local/bin/agentic-setup');
    expect(bashPath('/opt/homebrew/bin/agentic-setup')).toBe('/opt/homebrew/bin/agentic-setup');
    expect(bashPath('agentic-setup')).toBe('agentic-setup');
  });

  it('converts Windows backslashes to forward slashes', () => {
    expect(bashPath('C:\\Users\\First\\agentic-setup.cmd')).toBe(
      'C:/Users/First/agentic-setup.cmd',
    );
    expect(bashPath('C:\\Program Files\\agentic-setup\\agentic-setup.cmd')).toBe(
      'C:/Program Files/agentic-setup/agentic-setup.cmd',
    );
  });

  it('preserves drive letter prefix (Git Bash accepts C:/path/...)', () => {
    expect(bashPath('C:\\path\\to\\thing')).toBe('C:/path/to/thing');
  });

  it('is idempotent on already forward-slash paths', () => {
    expect(bashPath('C:/Users/foo')).toBe('C:/Users/foo');
  });

  it('handles mixed slash paths by normalizing all to forward', () => {
    expect(bashPath('C:/Users\\foo/bar\\baz')).toBe('C:/Users/foo/bar/baz');
  });

  it('returns empty string unchanged', () => {
    expect(bashPath('')).toBe('');
  });
});
