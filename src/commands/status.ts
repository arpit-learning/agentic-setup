import fs from 'fs';
import chalk from 'chalk';
import { readManifest } from '../writers/manifest.js';
import { loadConfig } from '../llm/config.js';
import { displayProductName } from '../lib/resolve-cli.js';
import { readProjectConfig } from '../lib/project-config.js';
import { getPackageVersion } from '../lib/package-version.js';

export async function statusCommand(options: { json?: boolean }) {
  const config = loadConfig();
  const manifest = readManifest();
  const projectConfig = readProjectConfig();

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          configured: !!config,
          provider: config?.provider,
          model: config?.model,
          manifest: manifest,
          project_config: projectConfig,
          cli_version: getPackageVersion(),
          pinned_cli_version: manifest?.cli_version,
          cli_version_drift: manifest?.cli_version && manifest.cli_version !== getPackageVersion(),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.bold('\nagentic-setup Status\n'));

  if (config) {
    console.log(`  LLM: ${chalk.green(config.provider)} (${config.model})`);
  } else {
    const bin = displayProductName();
    console.log(
      `  LLM: ${chalk.yellow('Not configured')} — run ${chalk.hex('#83D1EB')(`${bin} config`)}`,
    );
  }

  if (manifest?.cli_version) {
    const drift = manifest.cli_version !== getPackageVersion();
    console.log(
      `  Setup CLI: ${manifest.cli_version}${drift ? chalk.yellow(` (current: ${getPackageVersion()})`) : chalk.green(' (current)')}`,
    );
    if (manifest.setup_profile) {
      console.log(`  Profile: ${chalk.cyan(manifest.setup_profile)}`);
    }
    if (manifest.last_setup_at) {
      console.log(chalk.dim(`  Last setup: ${manifest.last_setup_at}`));
    }
  }

  console.log(
    `  Project config: ${fs.existsSync('.agentic-setup.yaml') ? chalk.green('present') : chalk.dim('default')}`,
  );
  console.log(
    chalk.dim(
      `  Agents: ${projectConfig.agents.join(', ')} · threshold ${projectConfig.readiness_threshold}%`,
    ),
  );

  if (!manifest) {
    console.log(`  Config: ${chalk.dim('No config applied')}`);
    console.log(
      chalk.dim('\n  Run ') +
        chalk.hex('#83D1EB')(`${displayProductName()} init`) +
        chalk.dim(' to get started.\n'),
    );
    return;
  }

  console.log(`  Files managed: ${chalk.cyan(manifest.entries.length.toString())}`);
  for (const entry of manifest.entries) {
    const exists = fs.existsSync(entry.path);
    const icon = exists ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${entry.path} (${entry.action})`);
  }

  console.log('');
}
