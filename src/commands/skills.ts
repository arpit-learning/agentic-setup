import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import * as p from '@clack/prompts';

import { validateModel } from '../llm/index.js';
import { getFastModel } from '../llm/config.js';
import { collectFingerprint, type Fingerprint } from '../fingerprint/index.js';
import {
  generateSkill,
  buildSkillContext,
  type SkillTopic,
  type GeneratedSkill,
} from '../ai/generate.js';
import { readProjectConfig } from '../lib/project-config.js';
import { createBackup } from '../writers/backup.js';
import { readManifest, writeManifest, fileChecksum } from '../writers/manifest.js';
import { extractAllDeps } from '../utils/dependencies.js';

function parseFrontmatter(content: string): { name: string; description: string } {
  const result = { name: '', description: '' };
  const lines = content.split('\n');
  if (lines[0]?.trim() === '---') {
    let i = 1;
    while (i < lines.length && lines[i].trim() !== '---') {
      const line = lines[i].trim();
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const val = line
          .slice(colonIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        if (key === 'name') result.name = val;
        else if (key === 'description') result.description = val;
      }
      i++;
    }
  }
  return result;
}

function proposeSkillTopics(fingerprint: Fingerprint): SkillTopic[] {
  const topics: SkillTopic[] = [
    {
      name: 'development-workflow',
      description:
        'Development setup and common workflows. Use when starting development, running the project, or setting up the environment.',
    },
    {
      name: 'testing-guide',
      description:
        'Testing patterns and commands. Use when writing tests, running test suites, or debugging test failures.',
    },
  ];

  const cleanName = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

  for (const lang of fingerprint.languages || []) {
    const name = cleanName(lang);
    if (!name || ['html', 'css', 'json', 'markdown', 'yaml'].includes(name)) continue;
    topics.push({
      name: `${name}-conventions`,
      description: `${lang} coding patterns, style guidelines, and type-safety rules.`,
    });
  }

  for (const fw of fingerprint.frameworks || []) {
    const name = cleanName(fw);
    if (!name) continue;
    topics.push({
      name: `${name}-patterns`,
      description: `${fw} architectural patterns, convention rules, and guidelines.`,
    });
  }

  for (const tool of fingerprint.tools || []) {
    const name = cleanName(tool);
    if (!name) continue;
    if (topics.some((t) => t.name.startsWith(name))) continue;
    topics.push({
      name: `${name}-guidelines`,
      description: `${tool} integration guidelines, configuration setups, and best practices.`,
    });
  }

  return topics;
}

async function writeSkillsToDisk(skills: GeneratedSkill[], targetAgents: string[]): Promise<void> {
  const repoRoot = process.cwd();
  const agentFolders: Record<string, string> = {
    claude: '.claude/skills',
    cursor: '.cursor/skills',
    codex: '.agents/skills',
    opencode: '.opencode/skills',
    antigravity: '.gemini/rules',
  };

  const filesToWrite: { path: string; content: string }[] = [];
  const existingFiles: string[] = [];

  for (const s of skills) {
    for (const agent of targetAgents) {
      const relFolder = agentFolders[agent];
      if (!relFolder) continue;

      const cleanSubdir =
        agent === 'claude' ? s.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase() : s.name;
      const skillPath = path.join(relFolder, cleanSubdir, 'SKILL.md');
      const absPath = path.join(repoRoot, skillPath);

      const frontmatterLines = ['---', `name: ${s.name}`, `description: ${s.description}`];
      if (agent === 'claude' && s.paths?.length) {
        frontmatterLines.push('paths:');
        for (const p of s.paths) {
          frontmatterLines.push(`  - ${p}`);
        }
      }
      frontmatterLines.push('---', '');
      const content = frontmatterLines.join('\n') + s.content;

      filesToWrite.push({ path: skillPath, content });
      if (fs.existsSync(absPath)) {
        existingFiles.push(skillPath);
      }
    }
  }

  // Backup existing
  const backupDir = existingFiles.length > 0 ? createBackup(existingFiles) : undefined;

  // Write files
  for (const item of filesToWrite) {
    const absPath = path.join(repoRoot, item.path);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absPath, item.content);
  }

  // Update manifest
  const existing = readManifest();
  const entries = existing ? [...existing.entries] : [];

  for (const item of filesToWrite) {
    const isModified = existingFiles.includes(item.path);
    entries.push({
      path: item.path,
      action: isModified ? 'modified' : 'created',
      checksum: fileChecksum(path.join(repoRoot, item.path)),
      timestamp: new Date().toISOString(),
    });
  }

  writeManifest({
    version: 1,
    backupDir: backupDir || existing?.backupDir,
    entries,
  });

  console.log(chalk.bold('\nSkills created/updated:'));
  for (const item of filesToWrite) {
    console.log(`  ${chalk.green('✓')} ${item.path}`);
  }
  if (backupDir) {
    console.log(chalk.dim(`\n  Backups saved to ${backupDir}`));
  }
}

export async function skillsListCommand(): Promise<void> {
  const repoRoot = process.cwd();
  const config = readProjectConfig(repoRoot);
  const targetAgents = config.agents;

  p.intro(chalk.cyan.bold('Active AI Skills'));
  let foundAny = false;

  const agentFolders: Record<string, string> = {
    claude: '.claude/skills',
    cursor: '.cursor/skills',
    codex: '.agents/skills',
    opencode: '.opencode/skills',
    antigravity: '.gemini/rules',
  };

  for (const agent of targetAgents) {
    const relFolder = agentFolders[agent];
    if (!relFolder) continue;
    const absFolder = path.join(repoRoot, relFolder);
    if (!fs.existsSync(absFolder)) continue;

    const subdirs = fs.readdirSync(absFolder).filter((f) => {
      try {
        return fs.statSync(path.join(absFolder, f)).isDirectory();
      } catch {
        return false;
      }
    });
    if (subdirs.length === 0) continue;

    console.log(`\n  ${chalk.cyan.bold('[' + agent + ']')}`);
    for (const subdir of subdirs) {
      const skillFile = path.join(absFolder, subdir, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        try {
          const content = fs.readFileSync(skillFile, 'utf-8');
          const fm = parseFrontmatter(content);
          const name = fm.name || subdir;
          const desc = fm.description || 'No description provided';
          console.log(`    ${chalk.green('•')} ${chalk.bold(name)}: ${desc}`);
          foundAny = true;
        } catch {
          // ignore read errors
        }
      }
    }
  }

  if (!foundAny) {
    console.log(
      chalk.dim(
        '    No active skills found. Run `agentic-setup skills generate` to create stack-specific skills.',
      ),
    );
  }
  console.log('');
  p.outro('Listed all active skills.');
}

export interface SkillsGenerateOptions {
  agent?: string[];
  dryRun?: boolean;
  autoApprove?: boolean;
}

export async function skillsGenerateCommand(options: SkillsGenerateOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  const config = readProjectConfig(repoRoot);
  const targetAgents = options.agent || config.agents;

  p.intro(chalk.cyan.bold('Skills Generator'));

  if (targetAgents.length === 0) {
    p.cancel(
      chalk.red('No target agents specified or configured. Run `agentic-setup config` first.'),
    );
    throw new Error('__exit__');
  }

  // 1. Validate LLM Provider
  try {
    await validateModel({ fast: true });
  } catch {
    p.cancel(
      chalk.red(
        'LLM provider is not configured properly. Run `agentic-setup config` to set up credentials.',
      ),
    );
    throw new Error('__exit__');
  }

  // 2. Scan project fingerprint
  const s = p.spinner();
  s.start('Scanning project stack...');
  const fingerprint = await collectFingerprint(repoRoot);
  s.stop('Project scanned successfully.');

  // 3. Propose skill topics
  const proposedTopics = proposeSkillTopics(fingerprint);
  if (proposedTopics.length === 0) {
    p.outro(chalk.yellow('No skill topics could be determined for the project.'));
    return;
  }

  let selectedTopics: SkillTopic[] = [];

  if (options.autoApprove) {
    selectedTopics = proposedTopics;
  } else {
    // Checkbox prompt to select topics
    const optionsList = proposedTopics.map((t) => ({
      value: t,
      label: t.name,
      hint: t.description,
    }));

    const result = await p.multiselect({
      message: 'Select which stack-specific skills you want to generate:',
      options: optionsList,
    });

    if (p.isCancel(result)) {
      p.cancel('Cancelled.');
      return;
    }
    selectedTopics = result as SkillTopic[];
  }

  if (selectedTopics.length === 0) {
    p.outro(chalk.yellow('No skills selected. Cancelled.'));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.yellow('\n[Dry run] Would generate skills for topics:'));
    for (const t of selectedTopics) {
      console.log(`  - ${t.name}: ${t.description}`);
    }
    p.outro('Dry run completed.');
    return;
  }

  // 4. Generate in parallel
  s.start(`Generating ${selectedTopics.length} skills in parallel...`);
  const fastModel = getFastModel();
  const allDeps = extractAllDeps(repoRoot);
  const skillContext = buildSkillContext(fingerprint, {}, allDeps);

  const skillResults = await Promise.allSettled(
    selectedTopics.map((topic) => generateSkill(skillContext, topic, fastModel)),
  );

  const generatedSkills: GeneratedSkill[] = [];
  const failedNames: string[] = [];

  for (let i = 0; i < skillResults.length; i++) {
    const result = skillResults[i];
    const topic = selectedTopics[i];
    if (result.status === 'fulfilled') {
      generatedSkills.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failedNames.push(`${topic.name} (${reason})`);
    }
  }

  if (generatedSkills.length === 0) {
    s.stop('All skills failed to generate.');
    if (failedNames.length > 0) {
      for (const name of failedNames) {
        console.log(`  → ${name}`);
      }
    }
    throw new Error('__exit__');
  }

  if (failedNames.length > 0) {
    s.stop(`Generated ${generatedSkills.length}/${selectedTopics.length} skills.`);
    for (const name of failedNames) {
      console.log(`  → ${name}`);
    }
  } else {
    s.stop(`Successfully generated ${generatedSkills.length} skills.`);
  }

  // 5. Write to disk
  await writeSkillsToDisk(generatedSkills, targetAgents);
  p.outro('Skills generation completed.');
}

export interface SkillsAddOptions {
  personal?: boolean;
}

export async function skillsAddCommand(
  nameArg?: string,
  descArg?: string,
  _options: SkillsAddOptions = {},
): Promise<void> {
  const repoRoot = process.cwd();
  const config = readProjectConfig(repoRoot);
  const targetAgents = config.agents;

  p.intro(chalk.cyan.bold('Add Custom Skill'));

  if (targetAgents.length === 0) {
    p.cancel(
      chalk.red('No target agents specified or configured. Run `agentic-setup config` first.'),
    );
    throw new Error('__exit__');
  }

  // Validate LLM provider
  try {
    await validateModel({ fast: true });
  } catch {
    p.cancel(
      chalk.red(
        'LLM provider is not configured properly. Run `agentic-setup config` to set up credentials.',
      ),
    );
    throw new Error('__exit__');
  }

  // Prompt for name and description if not provided
  let name = nameArg?.trim();
  if (!name) {
    const result = await p.text({
      message: 'Enter the skill name (e.g., react-hooks):',
      validate: (val) => (val && val.trim().length > 0 ? undefined : 'Skill name is required.'),
    });
    if (p.isCancel(result)) {
      p.cancel('Cancelled.');
      return;
    }
    name = result;
  }
  name = name.toLowerCase().replace(/[^a-z0-9-]/gi, '-');

  let desc = descArg?.trim();
  if (!desc) {
    const result = await p.text({
      message: 'Enter a short description of the skill:',
      validate: (val) => (val && val.trim().length > 0 ? undefined : 'Description is required.'),
    });
    if (p.isCancel(result)) {
      p.cancel('Cancelled.');
      return;
    }
    desc = result;
  }

  // Prompt for guidelines/custom rules
  const guidelines = await p.text({
    message: 'Enter custom rules/guidelines for this skill (leave blank to auto-generate):',
  });
  if (p.isCancel(guidelines)) {
    p.cancel('Cancelled.');
    return;
  }

  const s = p.spinner();
  s.start('Generating custom skill...');
  try {
    const fingerprint = await collectFingerprint(repoRoot);
    const allDeps = extractAllDeps(repoRoot);
    const skillContext = buildSkillContext(fingerprint, {}, allDeps);

    const topic: SkillTopic = {
      name,
      description: desc,
    };

    const finalContext = guidelines.trim()
      ? `USER CUSTOM RULES / REQUIREMENTS:\n${guidelines}\n\n${skillContext}`
      : skillContext;

    const fastModel = getFastModel();
    const skill = await generateSkill(finalContext, topic, fastModel);

    s.stop(`Custom skill generated successfully.`);

    // Write to disk
    await writeSkillsToDisk([skill], targetAgents);
    p.outro(chalk.green(`Successfully created custom skill "${name}".`));
  } catch (err) {
    s.stop('Failed to generate custom skill.');
    console.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
    throw new Error('__exit__');
  }
}

export async function skillsDeleteCommand(nameArg?: string): Promise<void> {
  const repoRoot = process.cwd();
  const config = readProjectConfig(repoRoot);
  const targetAgents = config.agents;

  p.intro(chalk.cyan.bold('Delete Skill'));

  let name = nameArg?.trim();
  if (!name) {
    const result = await p.text({
      message: 'Enter the name of the skill to delete:',
      validate: (val) => (val && val.trim().length > 0 ? undefined : 'Skill name is required.'),
    });
    if (p.isCancel(result)) {
      p.cancel('Cancelled.');
      return;
    }
    name = result;
  }
  name = name.toLowerCase().replace(/[^a-z0-9-]/gi, '-');

  const agentFolders: Record<string, string> = {
    claude: '.claude/skills',
    cursor: '.cursor/skills',
    codex: '.agents/skills',
    opencode: '.opencode/skills',
    antigravity: '.gemini/rules',
  };

  const filesToDelete: string[] = [];
  const dirsToDelete: string[] = [];

  for (const agent of targetAgents) {
    const relFolder = agentFolders[agent];
    if (!relFolder) continue;

    const cleanSubdir = agent === 'claude' ? name.replace(/[^a-z0-9-]/gi, '-').toLowerCase() : name;
    const skillDir = path.join(repoRoot, relFolder, cleanSubdir);
    const skillFile = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(skillFile)) {
      filesToDelete.push(skillFile);
      dirsToDelete.push(skillDir);
    }
  }

  if (filesToDelete.length === 0) {
    p.cancel(
      chalk.yellow(`No skill found matching the name "${name}" in any active agent directory.`),
    );
    return;
  }

  const confirmed = await p.confirm({
    message: `Are you sure you want to delete "${name}" from ${filesToDelete.length} location(s)?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled.');
    return;
  }

  const backupDir = createBackup(filesToDelete);

  for (const file of filesToDelete) {
    fs.unlinkSync(file);
  }
  for (const dir of dirsToDelete) {
    try {
      fs.rmdirSync(dir);
    } catch {
      // directory might not be empty
    }
  }

  // Update manifest
  const existing = readManifest();
  const entries = existing ? [...existing.entries] : [];
  for (const file of filesToDelete) {
    entries.push({
      path: path.relative(repoRoot, file),
      action: 'deleted',
      checksum: '',
      timestamp: new Date().toISOString(),
    });
  }
  writeManifest({
    version: 1,
    backupDir: backupDir || existing?.backupDir,
    entries,
  });

  console.log(chalk.green(`✓`) + ` Successfully deleted skill "${name}"`);
  if (backupDir) {
    console.log(chalk.dim(`  Backup saved to ${backupDir}`));
  }

  p.outro(chalk.green(`Successfully deleted skill "${name}".`));
}
