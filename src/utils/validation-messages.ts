import chalk from 'chalk';
import type { ValidationError } from '../llm/preflight.js';

/**
 * Format a validation error into a user-friendly ANSI-colored message.
 * Includes error title, detailed explanation, and recovery options.
 */
export function formatValidationError(error: ValidationError): string {
  const lines: string[] = [];

  // Header with provider and error title
  lines.push('');
  lines.push(chalk.red.bold('❌ Validation Error'));
  lines.push(chalk.red(`   Provider: ${error.provider}`));
  lines.push(chalk.red(`   Issue: ${error.error}`));
  lines.push('');

  // Detailed explanation
  lines.push(chalk.white(error.detail));
  lines.push('');

  // Recovery options
  if (error.recoveryOptions.length > 0) {
    lines.push(chalk.cyan('Recovery Options:'));
    error.recoveryOptions.forEach((opt, idx) => {
      const shortcut = ['F', 'S', 'K', 'E'][idx] || '?';
      lines.push(chalk.cyan(`  [${shortcut}] ${opt.label} (${opt.action})`));
    });
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a validation success message.
 * Shows provider and quick summary.
 */
export function formatValidationSuccess(provider: string, summary: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.green.bold('✓ Validation Passed'));
  lines.push(chalk.green(`  Provider: ${provider}`));
  if (summary) {
    lines.push(chalk.green(`  ${summary}`));
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format a message prompting the user for action on validation error.
 */
export function formatValidationPrompt(error: ValidationError): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.yellow.bold('Choose an action:'));

  error.recoveryOptions.forEach((opt, idx) => {
    const shortcuts = ['F', 'S', 'K', 'E'];
    const shortcut = shortcuts[idx] || '?';
    lines.push(chalk.yellow(`  (${shortcut}) ${opt.label}`));
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Get the shortcut key for a recovery option index.
 */
export function getRecoveryShortcut(index: number): string {
  const shortcuts = ['f', 's', 'k', 'e'];
  return shortcuts[index] || '';
}
