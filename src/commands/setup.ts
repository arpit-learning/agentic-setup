import chalk from 'chalk';
import {
  readProjectConfig,
  writeProjectConfig,
  mergeProjectConfig,
  type TargetAgentName,
} from '../lib/project-config.js';
import { initCommand } from './init.js';
import { codegraphSetupCommand } from './codegraph.js';
import { analyzeCommand } from './analyze.js';
import { compositeScoreCommand } from './composite-score.js';
import { doctorCommand } from './doctor.js';
import { hooksCommand } from './hooks.js';
import type { TargetAgent } from './init-prompts.js';

export interface SetupOptions {
  agent?: TargetAgentName[];
  dryRun?: boolean;
  skipCodegraph?: boolean;
  skipLlm?: boolean;
  json?: boolean;
  autoApprove?: boolean;
}

function toInitAgents(agents: TargetAgentName[]): TargetAgent {
  return agents;
}

export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  let config = readProjectConfig(repoRoot);

  if (options.agent?.length) {
    config = mergeProjectConfig({
      ...config,
      agents: options.agent,
    });
  }

  if (!options.dryRun) {
    writeProjectConfig(config, repoRoot);
  }

  const steps: { name: string; status: 'pending' | 'done' | 'skipped' }[] = [
    { name: 'hooks', status: 'pending' },
    { name: 'init', status: options.skipLlm ? 'skipped' : 'pending' },
    {
      name: 'codegraph',
      status: config.codegraph && !options.skipCodegraph ? 'pending' : 'skipped',
    },
    { name: 'analyze', status: config.analyze_on_setup ? 'pending' : 'skipped' },
    { name: 'readiness', status: 'pending' },
    { name: 'doctor', status: 'pending' },
  ];

  if (!options.json) {
    console.log('');
    console.log(chalk.bold.cyan('  agentic-setup — Full Setup'));
    console.log(chalk.dim(`  Agents: ${config.agents.join(', ')} · Profile: ${config.profile}`));
    console.log('');
  }

  const mark = (name: string, status: 'done' | 'skipped') => {
    const step = steps.find((s) => s.name === name);
    if (step) step.status = status;
  };

  if (!options.dryRun) {
    await hooksCommand({ install: true });
    mark('hooks', 'done');

    if (!options.skipLlm) {
      await initCommand({
        agent: toInitAgents(config.agents),
        autoApprove: options.autoApprove ?? true,
        dryRun: false,
        verbose: false,
      });
      mark('init', 'done');
    }

    if (config.codegraph && !options.skipCodegraph) {
      await codegraphSetupCommand({ dryRun: false, skipIndex: false });
      mark('codegraph', 'done');
    }

    if (config.analyze_on_setup) {
      await analyzeCommand({ json: false, dryRun: false });
      mark('analyze', 'done');
    }

    try {
      await compositeScoreCommand({ json: options.json, quiet: false });
      mark('readiness', 'done');
    } catch {
      mark('readiness', 'done');
    }

    try {
      await doctorCommand({ json: options.json, soft: true });
      mark('doctor', 'done');
    } catch {
      mark('doctor', 'done');
    }
  } else {
    for (const step of steps) step.status = 'skipped';
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          config,
          steps,
          dry_run: !!options.dryRun,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.bold.green('\n  Setup complete!\n'));
  console.log(chalk.dim('  Run `agentic-setup check` before commits or in CI.'));
  console.log('');
}
