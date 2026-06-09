import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe('pre-commit-block', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    const { resetResolvedCliBinary } = await import('../../lib/resolve-cli.js');
    resetResolvedCliBinary();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('appendPreCommitBlock', () => {
    it('uses npx command in doc block when in npx context', async () => {
      process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# My Project');

      // displayProductName uses cleaner 'npx agentic-setup' (no --yes) for display.
      // The --yes form is preserved for actual subprocess invocation via resolveCliBinary().
      expect(result).toContain('npx agentic-setup refresh');
      expect(result).toContain('npx agentic-setup refresh && git add');
    });

    it('uses bare agentic-setup in doc block when globally installed', async () => {
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');

      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# My Project');

      expect(result).toContain('agentic-setup refresh');
      expect(result).toContain('agentic-setup refresh && git add');
    });

    it('does not duplicate the block', async () => {
      process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const first = appendPreCommitBlock('# My Project');
      const second = appendPreCommitBlock(first);
      expect(second).toBe(first);
    });

    it('uses CLI setup fallback for all platforms', async () => {
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');

      const { appendPreCommitBlock } = await import('../pre-commit-block.js');

      for (const platform of ['claude', 'codex', 'copilot'] as const) {
        const result = appendPreCommitBlock('# My Project', platform);
        expect(result).toContain('npx agentic-setup setup');
        expect(result).not.toContain('/setup-agentic');
        expect(result).not.toContain('setup-agentic/SKILL.md');
      }
    });
  });

  describe('appendSyncBlock', () => {
    it('uses CLI setup instruction for all platforms', async () => {
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');

      const { appendSyncBlock } = await import('../pre-commit-block.js');

      for (const platform of ['claude', 'codex', 'copilot'] as const) {
        const result = appendSyncBlock('# My Project', platform);
        expect(result).toContain('npx agentic-setup setup');
        expect(result).not.toContain('/setup-agentic');
      }
    });
  });

  describe('getCursorPreCommitRule', () => {
    it('uses npx command in Cursor rule when in npx context', async () => {
      process.argv[1] = '/home/user/.npm/_npx/abc/node_modules/.bin/agentic-setup';
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { getCursorPreCommitRule } = await import('../pre-commit-block.js');
      const rule = getCursorPreCommitRule();

      expect(rule.content).toContain('npx agentic-setup refresh');
    });

    it('uses bare agentic-setup in Cursor rule when globally installed', async () => {
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');

      const { getCursorPreCommitRule } = await import('../pre-commit-block.js');
      const rule = getCursorPreCommitRule();

      expect(rule.content).toContain('agentic-setup refresh');
      expect(rule.content).toContain('npx agentic-setup setup');
    });
  });

  describe('getCursorSetupRule', () => {
    it('returns a setup discovery rule', async () => {
      const { getCursorSetupRule } = await import('../pre-commit-block.js');
      const rule = getCursorSetupRule();

      expect(rule.filename).toBe('agentic-setup.mdc');
      expect(rule.content).toContain('alwaysApply: true');
      expect(rule.content).toContain('SYNCED');
      expect(rule.content).toContain('NOT_SYNCED');
      expect(rule.content).toContain('npx agentic-setup setup');
      expect(rule.content).not.toContain('setup-agentic/SKILL.md');
    });
  });

  describe('F-P0-3: no absolute agentic-setup path baked into content', () => {
    beforeEach(async () => {
      // Force a "global install" resolution that returns an absolute path with a personal-looking prefix.
      const { resetResolvedCliBinary } = await import('../../lib/resolve-cli.js');
      resetResolvedCliBinary();
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/Users/someone/.nvm/versions/node/v20/bin/agentic-setup\n');
    });

    it('appendPreCommitBlock injects bare "agentic-setup" not the absolute resolution', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const out = appendPreCommitBlock('# test\n', 'claude');
      expect(out).not.toContain('/Users/');
      expect(out).not.toContain('.nvm/');
      expect(out).toMatch(/`agentic-setup refresh`/);
    });

    it('getCursorPreCommitRule injects bare "agentic-setup"', async () => {
      const { getCursorPreCommitRule } = await import('../pre-commit-block.js');
      const rule = getCursorPreCommitRule();
      expect(rule.content).not.toContain('/Users/');
      expect(rule.content).toMatch(/`agentic-setup refresh/);
    });

    it('appendSyncBlock injects bare "agentic-setup"', async () => {
      const { appendSyncBlock } = await import('../pre-commit-block.js');
      const out = appendSyncBlock('# test\n', 'claude');
      expect(out).not.toContain('/Users/');
      expect(out).toMatch(/`agentic-setup refresh`/);
    });

    it('getCursorSyncRule injects bare "agentic-setup"', async () => {
      const { getCursorSyncRule } = await import('../pre-commit-block.js');
      const rule = getCursorSyncRule();
      expect(rule.content).not.toContain('/Users/');
      expect(rule.content).toMatch(/`agentic-setup refresh`/);
    });
  });

  describe('activeTargets path filtering', () => {
    beforeEach(async () => {
      const { resetResolvedCliBinary } = await import('../../lib/resolve-cli.js');
      resetResolvedCliBinary();
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');
    });

    it('includes only claude paths when activeTargets is [claude]', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# Test', 'claude', ['claude']);
      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('.claude/');
      expect(result).not.toContain('.cursor/');
      expect(result).not.toContain('AGENTS.md');
      expect(result).not.toContain('.opencode/');
    });

    it('includes cursor paths when cursor is an active target', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# Test', 'claude', ['claude', 'cursor']);
      expect(result).toContain('.cursor/');
      expect(result).toContain('.cursorrules');
      expect(result).not.toContain('AGENTS.md');
    });

    it('includes all paths when activeTargets is undefined (backward compat)', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# Test', 'claude');
      expect(result).toContain('.cursor/');
      expect(result).toContain('AGENTS.md');
      expect(result).toContain('.opencode/');
    });

    it('omits claude paths for copilot-only target', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# Test', 'copilot', ['github-copilot']);
      expect(result).toContain('.github/copilot-instructions.md');
      expect(result).not.toContain('CLAUDE.md');
      expect(result).not.toContain('.claude/');
    });

    it('getCursorPreCommitRule respects activeTargets', async () => {
      const { getCursorPreCommitRule } = await import('../pre-commit-block.js');
      const rule = getCursorPreCommitRule(['claude', 'cursor']);
      expect(rule.content).toContain('.cursor/');
      expect(rule.content).not.toContain('AGENTS.md');
      expect(rule.content).not.toContain('.opencode/');
    });

    it('empty activeTargets array produces only AGENTIC_LEARNINGS.md', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const result = appendPreCommitBlock('# Test', 'claude', []);
      expect(result).toContain('AGENTIC_LEARNINGS.md');
      expect(result).not.toContain('CLAUDE.md');
      expect(result).not.toContain('.cursor/');
    });
  });

  describe('appendManagedBlocks de-duplication (F-P0-10)', () => {
    beforeEach(async () => {
      const { resetResolvedCliBinary } = await import('../../lib/resolve-cli.js');
      resetResolvedCliBinary();
      process.argv[1] = '/usr/local/bin/agentic-setup';
      delete process.env.npm_execpath;
      mockedExecSync.mockReturnValue('/usr/local/bin/agentic-setup\n');
    });

    it('hasPreCommitBlock detects unmarked inlined "Before Committing" with agentic-setup', async () => {
      const { hasPreCommitBlock } = await import('../pre-commit-block.js');
      const inlined =
        '# proj\n\n## Before Committing\n\nRun `agentic-setup refresh` before commit.\n';
      expect(hasPreCommitBlock(inlined)).toBe(true);
    });

    it('hasPreCommitBlock returns false for unrelated "Before Committing" heading', async () => {
      const { hasPreCommitBlock } = await import('../pre-commit-block.js');
      const unrelated = '# proj\n\n## Before Committing\n\nRun npm test.\n';
      expect(hasPreCommitBlock(unrelated)).toBe(false);
    });

    it('appendPreCommitBlock does NOT duplicate when inlined version exists', async () => {
      const { appendPreCommitBlock } = await import('../pre-commit-block.js');
      const inlined =
        '# proj\n\n## Before Committing\n\nRun `agentic-setup refresh` before commit.\n';
      const out = appendPreCommitBlock(inlined, 'claude');
      expect(out).toBe(inlined);
      expect((out.match(/## Before Committing/g) || []).length).toBe(1);
    });

    it('hasLearningsBlock detects unmarked inlined "Session Learnings" with AGENTIC_LEARNINGS', async () => {
      const { hasLearningsBlock } = await import('../pre-commit-block.js');
      const inlined = '# proj\n\n## Session Learnings\n\nRead AGENTIC_LEARNINGS.md for patterns.\n';
      expect(hasLearningsBlock(inlined)).toBe(true);
    });

    it('hasModelBlock detects unmarked inlined "Model Configuration" with AGENTIC_SETUP_MODEL', async () => {
      const { hasModelBlock } = await import('../pre-commit-block.js');
      const inlined =
        '# proj\n\n## Model Configuration\n\nUse AGENTIC_SETUP_MODEL env var to pin.\n';
      expect(hasModelBlock(inlined)).toBe(true);
    });

    it('hasSyncBlock detects unmarked inlined "Context Sync" with agentic-setup-ai-org link', async () => {
      const { hasSyncBlock } = await import('../pre-commit-block.js');
      const inlined =
        '# proj\n\n## Context Sync\n\nThis project uses [agentic-setup](https://github.com/arpit-pm1/agentic-setup).\n';
      expect(hasSyncBlock(inlined)).toBe(true);
    });

    it('hasPreCommitBlock returns FALSE when "agentic-setup" is in another section, not under "Before Committing"', async () => {
      // Reviewer nit on PR #203: scope marker check to text between heading and next `## `.
      // Here the user has a "## Before Committing" heading documenting their own
      // pre-commit checks (no agentic-setup), and "agentic-setup" appears in an unrelated
      // "## Tools We Use" section. agentic-managed dedup must NOT fire.
      const { hasPreCommitBlock } = await import('../pre-commit-block.js');
      const content = `# proj

## Before Committing

Run npm test and lint.

## Tools We Use

We use \`eslint\` for some other purpose, and prettier, etc.
`;
      expect(hasPreCommitBlock(content)).toBe(false);
    });

    it('hasLearningsBlock returns FALSE when AGENTIC_LEARNINGS is mentioned outside the "Session Learnings" section', async () => {
      const { hasLearningsBlock } = await import('../pre-commit-block.js');
      const content = `# proj

## Session Learnings

We track lessons in our own format here.

## Tools

The \`AGENTIC_LEARNINGS\` env var configures something else.
`;
      expect(hasLearningsBlock(content)).toBe(false);
    });

    it('hasModelBlock returns FALSE when AGENTIC_SETUP_MODEL is mentioned outside "Model Configuration"', async () => {
      const { hasModelBlock } = await import('../pre-commit-block.js');
      const content = `# proj

## Model Configuration

We use claude-sonnet-4-6.

## Env Vars

\`AGENTIC_SETUP_MODEL\` is documented here for our internal tools.
`;
      expect(hasModelBlock(content)).toBe(false);
    });

    it('hasSyncBlock returns FALSE when agentic-setup link is outside "Context Sync"', async () => {
      const { hasSyncBlock } = await import('../pre-commit-block.js');
      const content = `# proj

## Context Sync

We sync via our own internal tooling.

## See Also

[agentic-setup](https://github.com/arpit-pm1/agentic-setup) is a related project.
`;
      expect(hasSyncBlock(content)).toBe(false);
    });

    it('appendManagedBlocks on already-inlined CLAUDE.md is a no-op', async () => {
      const { appendManagedBlocks } = await import('../pre-commit-block.js');
      const inlined = `# proj

## Before Committing

Run \`agentic-setup refresh\` before commit.

## Session Learnings

Read AGENTIC_LEARNINGS.md for patterns.

## Model Configuration

Use AGENTIC_SETUP_MODEL env var to pin.

## Context Sync

This project uses [agentic-setup](https://github.com/arpit-pm1/agentic-setup).
`;
      const out = appendManagedBlocks(inlined, 'claude');
      expect(out).toBe(inlined);
      expect((out.match(/## Before Committing/g) || []).length).toBe(1);
      expect((out.match(/## Session Learnings/g) || []).length).toBe(1);
      expect((out.match(/## Model Configuration/g) || []).length).toBe(1);
      expect((out.match(/## Context Sync/g) || []).length).toBe(1);
    });
  });
});
