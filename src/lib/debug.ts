import chalk from 'chalk';

const DEBUG_ENV = 'AGENTIC_SETUP_DEBUG';

/** Returns true when debug mode is enabled via --debug flag or AGENTIC_SETUP_DEBUG env var. */
export function isDebugMode(): boolean {
  const val = process.env[DEBUG_ENV];
  return val === '1' || val === 'true';
}

/** Enable debug mode programmatically (called by --debug CLI flag). */
export function enableDebugMode(): void {
  process.env[DEBUG_ENV] = '1';
}

/**
 * Log a debug message to stderr (dim gray prefix). No-op when debug mode is off.
 * @param label  Short context label, e.g. "antigravity" or "spawn"
 * @param lines  Additional lines to print under the label
 */
export function debugLog(label: string, ...lines: string[]): void {
  if (!isDebugMode()) return;
  const prefix = chalk.dim(`  [debug:${label}]`);
  console.error(`${prefix} ${lines[0] ?? ''}`);
  for (const line of lines.slice(1)) {
    console.error(`${chalk.dim('            ')} ${line}`);
  }
}

/**
 * Print a structured debug block with a header and indented body lines.
 * No-op when debug mode is off.
 */
export function debugBlock(header: string, body: string): void {
  if (!isDebugMode()) return;
  const trimmed = body.trim();
  if (!trimmed) return;
  console.error(chalk.dim(`\n  ── ${header} ─────────────────────────`));
  for (const line of trimmed.split('\n')) {
    console.error(chalk.dim(`  │ ${line}`));
  }
  console.error(chalk.dim('  ─────────────────────────────────────\n'));
}
