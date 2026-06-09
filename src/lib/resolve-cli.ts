import fs from 'fs';
import { execSync } from 'child_process';

let _resolved: string | null = null;

const WINDOWS_EXEC_EXT = /\.(cmd|exe|bat)$/i;
const NPX_RESOLUTION_RE = /[\\/]npx(?:\.(?:cmd|exe|bat))? --yes agentic-setup$/i;

/**
 * Pick the best executable from `where`/`which` output.
 *
 * On Windows, npm installs both an extensionless POSIX shell shim and a
 * `.cmd` shim. `where` lists the POSIX shim first, but Node cannot exec it
 * directly — only `.cmd`/`.exe`/`.bat` are spawnable on Windows.
 */
export function pickExecutable(out: string): string {
  const lines = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (process.platform === 'win32') {
    return lines.find((l) => WINDOWS_EXEC_EXT.test(l)) ?? lines[0] ?? '';
  }
  return lines[0] ?? '';
}

/**
 * Resolve the absolute path to the `agentic-setup` binary.
 * Caches the result so the lookup happens at most once per process.
 *
 * Always returns an absolute path when possible so that hook commands
 * embedded in .git/hooks/pre-commit or .claude/settings.json continue
 * to work even when the hook executor runs with a stripped $PATH
 * (e.g. Claude Code hooks use /usr/bin:/bin:/usr/sbin:/sbin on macOS).
 */
export function resolveCliBinary(): string {
  if (_resolved) return _resolved;

  const whichCmd = process.platform === 'win32' ? 'where agentic-setup' : 'which agentic-setup';
  const whichNpxCmd = process.platform === 'win32' ? 'where npx' : 'which npx';

  // 0. Detect npx context — temp paths become stale after the npx process exits.
  //    Prefer a globally-installed agentic-setup (stable absolute path). If not found,
  //    resolve npx to an absolute path so the hook command survives restricted $PATH.
  const isNpx = process.argv[1]?.includes('_npx') || process.env.npm_execpath?.includes('npx');
  if (isNpx) {
    // Prefer a globally-installed agentic-setup over the ephemeral npx invocation
    try {
      const out = execSync(whichCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      const cliPath = pickExecutable(out);
      if (cliPath) {
        _resolved = cliPath;
        return _resolved;
      }
    } catch {
      // not globally installed — fall through to npx
    }
    // Resolve npx to an absolute path so hooks don't depend on $PATH at runtime
    try {
      const out = execSync(whichNpxCmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      const npxPath = pickExecutable(out);
      if (npxPath) {
        _resolved = `${npxPath} --yes agentic-setup`;
        return _resolved;
      }
    } catch {
      // npx not found on PATH — fall back to bare name
    }
    _resolved = 'npx --yes agentic-setup';
    return _resolved;
  }

  // 1. Find agentic-setup on PATH — capture the absolute path so hook commands work
  //    in restricted $PATH environments (git hooks, Claude Code hooks, CI).
  try {
    const out = execSync(whichCmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const cliPath = pickExecutable(out);
    if (cliPath) {
      _resolved = cliPath;
      return _resolved;
    }
  } catch {
    // not on PATH — fall through
  }

  // 2. Derive from our own process.argv[1] (the script being executed)
  //    Only accept paths that look like a agentic-setup binary — avoids picking up
  //    test runner scripts (vitest, jest) in CI/test environments.
  const binPath = process.argv[1];
  if (binPath && /agentic-setup/.test(binPath) && fs.existsSync(binPath)) {
    _resolved = binPath;
    return _resolved;
  }

  // 3. Last resort: bare command (may still fail in /bin/sh)
  _resolved = 'agentic-setup';
  return _resolved;
}

/** True when the resolved binary is a multi-word npx invocation (bare or absolute path). */
export function isNpxResolution(): boolean {
  const r = resolveCliBinary();
  if (r === 'npx --yes agentic-setup') return true;
  // Match absolute paths on POSIX (/npx) and Windows (\npx, \npx.cmd, \npx.exe)
  return NPX_RESOLUTION_RE.test(r);
}

/**
 * Returns a display-friendly agentic-setup binary name for embedding in
 * user-facing text and committed files (CLAUDE.md, skills, cursor rules).
 *
 * Unlike resolveCliBinary() — which returns an absolute path so hook
 * subprocesses with stripped PATH can still find the binary — this
 * function returns just `agentic-setup` (or `npx agentic-setup` for npx
 * users) on the assumption that the user's interactive shell has agentic-setup
 * on PATH and that committed content will be read by teammates whose
 * absolute install paths differ.
 *
 * See audit finding F-P0-3 in
 */
export function displayProductName(): string {
  return isNpxResolution() ? 'npx agentic-setup' : 'agentic-setup';
}

/** Reset cached resolution — only for tests. */
export function resetResolvedCliBinary(): void {
  _resolved = null;
}

/**
 * Check whether a hook command refers to agentic-setup, regardless of whether
 * it uses a bare `agentic-setup` or an absolute path ending in `agentic-setup`.
 * Matches by looking for the agentic-setup binary name + the subcommand tail.
 *
 * Example: matches both `agentic-setup refresh --quiet` and `/usr/local/bin/agentic-setup refresh --quiet`
 */
export function isCliCommand(command: string, subcommandTail: string): boolean {
  const tails = [
    `agentic-setup ${subcommandTail}`,
    `agentic-setup ${subcommandTail}`,
    `npx --yes agentic-setup ${subcommandTail}`,
    `npx agentic-setup ${subcommandTail}`,
    `npx --yes agentic-setup ${subcommandTail}`,
    `npx agentic-setup ${subcommandTail}`,
  ];
  if (tails.includes(command)) return true;
  if (command.endsWith(`/agentic-setup ${subcommandTail}`)) return true;
  if (command.endsWith(`/agentic-setup ${subcommandTail}`)) return true;
  if (command.endsWith(`/npx --yes agentic-setup ${subcommandTail}`)) return true;
  if (command.endsWith(`/npx agentic-setup ${subcommandTail}`)) return true;
  if (command.endsWith(`/npx --yes agentic-setup ${subcommandTail}`)) return true;
  return false;
}
