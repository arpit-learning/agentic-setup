import fs from 'fs';
import path from 'path';
import { appendManagedBlocks } from '../pre-commit-block.js';

interface AntigravityConfig {
  agentsMd: string;
  skills?: Array<{ name: string; description: string; content: string }>;
}

export function writeAntigravityConfig(config: AntigravityConfig): string[] {
  const written: string[] = [];

  fs.writeFileSync('AGENTS.md', appendManagedBlocks(config.agentsMd, 'antigravity'));
  written.push('AGENTS.md');

  if (config.skills?.length) {
    for (const skill of config.skills) {
      const skillDir = path.join('.gemini', 'rules', skill.name);
      if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
      const skillPath = path.join(skillDir, 'SKILL.md');
      const frontmatter = [
        '---',
        `name: ${skill.name}`,
        `description: ${skill.description}`,
        '---',
        '',
      ].join('\n');
      fs.writeFileSync(skillPath, frontmatter + skill.content);
      written.push(skillPath);
    }
  }

  return written;
}
