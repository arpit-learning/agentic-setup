# agentic-setup

`agentic-setup` — AI context infrastructure CLI. Scores, generates, and syncs agent configs.

## Commands

```bash
npm run build        # tsdown → dist/
npm run dev          # watch mode
npm run test         # vitest run
npm run lint         # eslint src/
npx tsc --noEmit     # type check
```

## Architecture

**Entry**: `src/bin.ts` → `src/cli.ts` · **Build**: `tsdown.config.ts` · **Test**: `vitest.config.ts` · **Lint**: `eslint.config.js`

**Commands** (`src/commands/`): `init.ts` · `score.ts` · `refresh.ts` · `regenerate.ts` · `config.ts` · `hooks.ts` · `learn.ts` · `recommend.ts` · `sources.ts` · `undo.ts` · `status.ts` · `setup-files.ts`

**LLM** (`src/llm/`): `anthropic.ts` · `vertex.ts` · `openai-compat.ts` · `cursor-acp.ts` · `claude-cli.ts` · `types.ts` · `config.ts` · `model-recovery.ts`

**AI** (`src/ai/`): `generate.ts` · `refine.ts` · `refresh.ts` · `detect.ts` · `learn.ts` · `score-refine.ts` · `prompts.ts`

**Fingerprint** (`src/fingerprint/`): `index.ts` · `file-tree.ts` · `code-analysis.ts` · `sources.ts` · `cache.ts`

**Scoring** (`src/scoring/`): `index.ts` · `constants.ts` · `display.ts` · Checks: `checks/existence.ts` · `checks/quality.ts` · `checks/grounding.ts` · `checks/accuracy.ts` · `checks/freshness.ts` · `checks/bonus.ts`

**Writers** (`src/writers/`): `index.ts` · `claude/index.ts` · `cursor/index.ts` · `codex/index.ts` · `github-copilot/index.ts` · `staging.ts` · `manifest.ts` · `backup.ts`

**Lib** (`src/lib/`): `hooks.ts` · `state.ts` · `resolve-cli.ts` · `builtin-skills.ts` · `sanitize.ts` · `git-diff.ts`

**Other**: `src/constants.ts` · `tests/setup.ts` · `github-action/` · `packages/mcp-server/` · `packages/shared/` · `apps/`

## Conventions

- ESM with `.js` extensions · Tests in `tests/` (mirrors `src/`) · `unknown` over `any`
- Conventional commits (`feat:`, `fix:`, `refactor:`) · Dev: `next`, Stable: `master`
- Providers implement `LLMProvider` from `src/llm/types.ts`
- Writers in `src/writers/claude/index.ts` · `src/writers/codex/index.ts` return `string[]`
- Scoring checks in `src/scoring/checks/` return `Check[]`
- No hardcoded mappings — LLM-driven via `src/ai/detect.ts`
- `collectFingerprint()` async with LLM enrichment (`src/fingerprint/index.ts`)
- MCP server workspace: `packages/mcp-server/`

<!-- agentic:managed:pre-commit -->
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure agentic-setup syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "agentic-setup will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run agentic-setup manually before committing:
  1. Tell the user: "agentic-setup: Syncing agent configs with your latest changes..."
  2. Run: `agentic-setup refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md AGENTIC_LEARNINGS.md 2>/dev/null`
  3. After it completes, briefly tell the user what agentic-setup updated. Then proceed with the commit.

If `agentic-setup` is not found, tell the user: "This project uses agentic-setup for agent config sync. Run /setup-agentic to get set up."
<!-- /agentic:managed:pre-commit -->

<!-- agentic:managed:learnings -->
## Session Learnings

Read `AGENTIC_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /agentic:managed:learnings -->
