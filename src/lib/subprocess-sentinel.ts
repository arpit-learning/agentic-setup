/**
 * Sentinel for detecting whether the current process was spawned by agentic-setup itself.
 *
 * Why this exists:
 * agentic-setup spawns LLM subprocesses (`claude -p`, `cursor agent --print`, `opencode run`)
 * to do its work. Those subprocesses inherit the project's `.claude/settings.json`,
 * which contains hooks agentic-setup installed itself (Stop, SessionEnd, PostToolUse, etc).
 * Without a sentinel those hooks re-invoke agentic-setup, which re-spawns the LLM, which
 * re-fires the same hooks — a recursive cascade.
 *
 * The contract:
 *   - Spawn helpers wrap their env with `withAgenticSetupSubprocessEnv()` so descendants see the sentinel.
 *   - Hook entry points check `isAgenticSetupSubprocess()` and short-circuit if true.
 */

export const AGENTIC_SETUP_SUBPROCESS_ENV = 'AGENTIC_SETUP_SUBPROCESS';
export const AGENTIC_SETUP_SPAWNED_ENV = 'AGENTIC_SETUP_SPAWNED';

/**
 * Returns true when the current process was spawned by agentic-setup itself.
 * Hook entry points should check this and exit early to prevent recursive cascades.
 */
export function isAgenticSetupSubprocess(): boolean {
  return (
    process.env[AGENTIC_SETUP_SUBPROCESS_ENV] === '1' ||
    Boolean(process.env[AGENTIC_SETUP_SPAWNED_ENV])
  );
}

/**
 * Returns a NEW env object marked as an agentic-setup subprocess. Pass this to
 * `child_process.spawn(..., { env })` so the marker is inherited by descendants.
 */
export function withAgenticSetupSubprocessEnv<T extends NodeJS.ProcessEnv>(env: T): T {
  return {
    ...env,
    [AGENTIC_SETUP_SUBPROCESS_ENV]: '1',
    [AGENTIC_SETUP_SPAWNED_ENV]: '1',
  };
}

/**
 * True when this agentic-setup invocation is firing as a SessionEnd / hook
 * cascade from inside an unrelated (user-initiated) Claude Code session.
 */
export function isHookCascadeFromUserClaudeSession(): boolean {
  const inClaudeSession = process.env.CLAUDECODE === '1';
  const isAgenticSetupSpawned = isAgenticSetupSubprocess();
  const isInteractiveTty = process.stdin.isTTY === true;
  return inClaudeSession && !isAgenticSetupSpawned && !isInteractiveTty;
}
