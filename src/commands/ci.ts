import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/github/workflows/agentic-sync.yml');

export interface CiInitOptions {
  dryRun?: boolean;
  force?: boolean;
}

export async function ciInitCommand(options: CiInitOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, '.github', 'workflows');
  const outPath = path.join(outDir, 'agentic-sync.yml');

  if (fs.existsSync(outPath) && !options.force) {
    console.log(chalk.yellow(`  Workflow already exists: ${outPath}`));
    console.log(chalk.dim('  Use --force to overwrite.'));
    return;
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found: ${TEMPLATE_PATH}`);
  }

  const content = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  if (!options.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, content);
  }

  console.log('');
  console.log(chalk.bold.green('  ✓ GitHub workflow written'));
  console.log(chalk.dim(`    ${outPath}`));
  console.log('');
  console.log(chalk.dim('  Add repository secrets: ANTHROPIC_API_KEY (or your LLM provider key).'));
  console.log('');
}
