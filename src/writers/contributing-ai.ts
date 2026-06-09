import fs from 'fs';
import path from 'path';
import { displayProductName } from '../lib/resolve-cli.js';

const BLOCK_START = '<!-- agentic:managed:contributing-ai -->';
const BLOCK_END = '<!-- /agentic:managed:contributing-ai -->';

function getContributingAiBlock(): string {
  const bin = displayProductName();
  return `${BLOCK_START}
## AI-assisted development

This project uses **agentic-setup** to keep agent configs (\`CLAUDE.md\`, Cursor rules, \`AGENTS.md\`) in sync with the codebase.

### New contributors

1. Run in your terminal:
   \`\`\`bash
   ${bin} setup
   \`\`\`
2. Verify setup before opening a PR:
   \`\`\`bash
   ${bin} check
   \`\`\`

### Rules

- Never commit API keys or \`.env\` secrets.
- Run \`${bin} refresh\` (or commit normally — the pre-commit hook syncs configs) when you change architecture or commands.
- Prefer \`run.md\` for local startup and health-check instructions.

${BLOCK_END}`;
}

export function appendContributingAiBlock(content: string): string {
  if (content.includes(BLOCK_START)) return content;
  const trimmed = content.trimEnd();
  return `${trimmed}\n\n${getContributingAiBlock()}\n`;
}

export function writeContributingAiSection(
  repoRoot: string,
  options: { dryRun?: boolean } = {},
): { written: boolean; path: string } {
  const file = path.join(repoRoot, 'CONTRIBUTING.md');
  if (!fs.existsSync(file)) {
    return { written: false, path: file };
  }
  const content = fs.readFileSync(file, 'utf-8');
  if (content.includes(BLOCK_START)) {
    return { written: false, path: file };
  }
  if (!options.dryRun) {
    fs.writeFileSync(file, appendContributingAiBlock(content));
  }
  return { written: true, path: file };
}
