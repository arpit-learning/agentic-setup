import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import * as p from '@clack/prompts';
import { fileURLToPath } from 'url';
import ora from 'ora';
import { llmJsonCall, validateModel } from '../llm/index.js';
import { collectFingerprint } from '../fingerprint/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT =
  [
    path.resolve(__dirname, '../../templates/github/workflows'), // dev
    path.resolve(__dirname, '../templates/github/workflows'), // prod
  ].find((p) => fs.existsSync(p)) || path.resolve(__dirname, '../templates/github/workflows');

export interface CiInitOptions {
  dryRun?: boolean;
  force?: boolean;
}

const COMMON_WORKFLOWS = [
  { label: '✨ Generate tailored CI/CD pipelines with AI', value: 'ai_generate' },
  { label: 'Agentic Sync (agentic-sync.yml)', value: 'common/agentic-sync.yml' },
  { label: 'Agentic Score (agentic-score.yml)', value: 'common/agentic-score.yml' },
  { label: 'CodeQL Analysis (codeql.yml)', value: 'common/codeql.yml' },
  { label: 'PR Size Labeler (pr-size.yml)', value: 'common/pr-size.yml' },
  { label: 'README Badges Update (readme-badges.yml)', value: 'common/readme-badges.yml' },
];

const NODE_WORKFLOWS = [
  { label: 'Node.js CI (ci.yml)', value: 'node/ci.yml' },
  { label: 'Version Bump (version-bump.yml)', value: 'node/version-bump.yml' },
  { label: 'Publish Package (publish-package.yml)', value: 'node/publish-package.yml' },
];

const JAVA_WORKFLOWS = [
  { label: 'Java CI with Maven (ci-maven.yml)', value: 'java/ci-maven.yml' },
  { label: 'Java CI with Gradle (ci-gradle.yml)', value: 'java/ci-gradle.yml' },
];

interface GeneratedWorkflow {
  filename: string;
  description: string;
  content: string;
}

export async function ciInitCommand(options: CiInitOptions = {}): Promise<void> {
  const repoRoot = process.cwd();

  // Detect language
  const isNode = fs.existsSync(path.join(repoRoot, 'package.json'));
  const isJava =
    fs.existsSync(path.join(repoRoot, 'pom.xml')) ||
    fs.existsSync(path.join(repoRoot, 'build.gradle')) ||
    fs.existsSync(path.join(repoRoot, 'build.gradle.kts'));

  const promptOptions = [...COMMON_WORKFLOWS];
  if (isNode) {
    promptOptions.push(...NODE_WORKFLOWS);
  }
  if (isJava) {
    promptOptions.push(...JAVA_WORKFLOWS);
  }

  const result = await p.multiselect({
    message: 'Select GitHub workflows to initialize:',
    options: promptOptions,
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    return;
  }

  const selectedWorkflows = result as string[];
  const outDir = path.join(repoRoot, '.github', 'workflows');

  if (!options.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('');

  // Handle AI generated workflows
  if (selectedWorkflows.includes('ai_generate')) {
    const spinner = ora('Analyzing project structure & generating pipelines...').start();
    try {
      await validateModel({ fast: true });
      const fingerprint = await collectFingerprint(repoRoot);
      const stackParts = [
        ...fingerprint.languages,
        ...fingerprint.frameworks,
        ...fingerprint.tools,
      ];

      const prompt = `You are a DevOps expert. The user wants to generate GitHub Actions CI/CD workflows for their project.
Stack: ${stackParts.join(', ')}
Description: ${fingerprint.description || 'A software project'}

File tree:
${fingerprint.fileTree.slice(0, 300).join('\n')}

Generate standard, robust GitHub Actions workflows. Create a main CI pipeline (testing/linting) and any other highly recommended workflows (like a publish/release pipeline if applicable).
Format the output as JSON:
{
  "workflows": [
    { "filename": "ci.yml", "description": "Run tests and linting", "content": "..." }
  ]
}
Ensure the content is valid YAML.`;

      const aiResponse = await llmJsonCall<{ workflows: GeneratedWorkflow[] }>({
        system: 'You are an expert DevOps AI that generates GitHub Actions workflows.',
        prompt,
      });

      spinner.succeed('AI pipelines generated');

      for (const workflow of aiResponse.workflows) {
        const outPath = path.join(outDir, workflow.filename);
        if (fs.existsSync(outPath) && !options.force) {
          console.log(
            chalk.yellow(`  Workflow already exists: ${outPath} (Use --force to overwrite)`),
          );
          continue;
        }
        if (!options.dryRun) {
          fs.writeFileSync(outPath, workflow.content);
        }
        console.log(
          chalk.bold.green(`  ✓ Created ${outPath} `) + chalk.dim(`- ${workflow.description}`),
        );
      }
    } catch (error) {
      spinner.fail('Failed to generate pipelines with AI');
      console.log(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      console.log(
        chalk.dim('  Ensure you have an LLM provider configured (run `agentic-setup config`).'),
      );
    }
  }

  // Handle static templates
  const javaWorkflowsSelected = selectedWorkflows.some((w) => w.startsWith('java/'));
  let javaVersion: string | null = null;
  let jdkDistribution: string | null = null;

  if (javaWorkflowsSelected) {
    const vResult = await p.select({
      message: 'Select the Java version for your CI pipeline:',
      options: [
        { label: 'Java 21', value: '21' },
        { label: 'Java 17', value: '17' },
        { label: 'Java 11', value: '11' },
        { label: 'Java 8', value: '8' },
      ],
      initialValue: '17',
    });
    if (p.isCancel(vResult)) {
      p.cancel('Cancelled.');
      return;
    }
    javaVersion = vResult as string;

    const dResult = await p.select({
      message: 'Select the JDK distribution:',
      options: [
        { label: 'Temurin (Eclipse)', value: 'temurin' },
        { label: 'Corretto (Amazon)', value: 'corretto' },
        { label: 'Zulu (Azul Systems)', value: 'zulu' },
        { label: 'Microsoft', value: 'microsoft' },
        { label: 'Liberica (BellSoft)', value: 'liberica' },
      ],
      initialValue: 'temurin',
    });
    if (p.isCancel(dResult)) {
      p.cancel('Cancelled.');
      return;
    }
    jdkDistribution = dResult as string;
  }

  for (const workflowPath of selectedWorkflows) {
    if (workflowPath === 'ai_generate') continue;

    const templatePath = path.join(TEMPLATES_ROOT, workflowPath);
    const fileName = path.basename(workflowPath);
    const outPath = path.join(outDir, fileName);

    if (!fs.existsSync(templatePath)) {
      console.log(chalk.red(`  Template not found: ${workflowPath}`));
      continue;
    }

    if (fs.existsSync(outPath) && !options.force) {
      console.log(chalk.yellow(`  Workflow already exists: ${outPath} (Use --force to overwrite)`));
      continue;
    }

    let content = fs.readFileSync(templatePath, 'utf-8');
    if (workflowPath.startsWith('java/') && javaVersion && jdkDistribution) {
      content = content.replace(/{{JAVA_VERSION}}/g, javaVersion);
      content = content.replace(/{{JDK_DISTRIBUTION}}/g, jdkDistribution);
    }

    if (!options.dryRun) {
      fs.writeFileSync(outPath, content);
    }

    console.log(chalk.bold.green(`  ✓ Created ${outPath}`));
  }

  console.log('');
  if (selectedWorkflows.includes('common/agentic-sync.yml')) {
    console.log(
      chalk.dim(
        '  Add repository secrets: ANTHROPIC_API_KEY (or your LLM provider key) for agentic-sync.',
      ),
    );
  }
  console.log('');
}
