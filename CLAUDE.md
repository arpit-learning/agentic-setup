# agentic-setup

## What Is This

`agentic-setup` — CLI that keeps AI agent configs in sync with your codebase. Generates and refreshes `CLAUDE.md`, `.cursor/rules/`, `AGENTS.md`, `.github/copilot-instructions.md`, and skills across Claude Code, Cursor, Codex, OpenCode, and GitHub Copilot. Supports Anthropic, OpenAI, Google Vertex AI, OpenAI-compatible endpoints, Claude Code CLI, and Cursor ACP.

## Commands

```bash
npm run build        # tsdown → dist/
npm run dev          # watch mode
npm run test         # vitest run
npm run lint         # eslint src/
npx tsc --noEmit     # type check
npx vitest run tests/scoring/accuracy.test.ts  # single test
```

## Architecture

**Entry**: `src/bin.ts` → `src/cli.ts` (Commander.js) · **Config**: `tsconfig.json` · `tsdown.config.ts` · `vitest.config.ts` · `eslint.config.js` · `.prettierrc`

**Commands** (`src/commands/`): `init.ts` · `score.ts` · `refresh.ts` · `regenerate.ts` · `config.ts` · `hooks.ts` · `insights.ts` · `learn.ts` · `recommend.ts` · `sources.ts` · `publish.ts` · `undo.ts` · `status.ts` · `bootstrap.ts` · `uninstall.ts` · Helpers: `init-helpers.ts` · `init-prompts.ts` · `init-display.ts` · `setup-files.ts` · `interactive-provider-setup.ts`

**LLM** (`src/llm/`): `anthropic.ts` · `vertex.ts` · `openai-compat.ts` · `cursor-acp.ts` · `claude-cli.ts` · `types.ts` · `config.ts` · `utils.ts` · `usage.ts` · `model-recovery.ts` · `seat-based-errors.ts` · `index.ts`

**AI** (`src/ai/`): `generate.ts` · `refine.ts` · `refresh.ts` · `detect.ts` · `learn.ts` · `score-refine.ts` · `prompts.ts` · `stream-parser.ts` · `index.ts`

**Fingerprint** (`src/fingerprint/`): `index.ts` · `file-tree.ts` · `code-analysis.ts` · `existing-config.ts` · `sources.ts` · `git.ts` · `cache.ts`

**Scoring** (`src/scoring/`): `index.ts` · `display.ts` · `constants.ts` · `utils.ts` · `history.ts` · `dismissed.ts` · Checks (`src/scoring/checks/`): `existence.ts` · `quality.ts` · `grounding.ts` · `accuracy.ts` · `freshness.ts` · `bonus.ts` · `sources.ts`

**Writers** (`src/writers/`): `index.ts` · `claude/index.ts` · `cursor/index.ts` · `codex/index.ts` · `opencode/index.ts` · `github-copilot/index.ts` · `refresh.ts` · `staging.ts` · `backup.ts` · `manifest.ts` · `pre-commit-block.ts`

**Scanner** (`src/scanner/`): `index.ts` — detects local `.mcp.json`, `.cursor/mcp.json` MCP servers, rules, and skills across platforms

**Lib** (`src/lib/`): `hooks.ts` · `learning-hooks.ts` · `state.ts` · `resolve-cli.ts` · `builtin-skills.ts` · `sanitize.ts` · `notifications.ts` · `git-diff.ts` · `lock.ts` · `debug-report.ts` · `config-discovery.ts` · `terminal.ts`

**Utils** (`src/utils/`): `parallel-tasks.ts` · `spinner-messages.ts` · `editor.ts` · `review.ts` · `prompt.ts` · `version-check.ts` · `dependencies.ts` · `waiting-content.ts` · `waiting-cards.json`

**Telemetry** (`src/telemetry/`): `index.ts` · `config.ts` · `events.ts` · **Learner** (`src/learner/`): `writer.ts` · `storage.ts` · `attribution.ts` · `roi.ts` · `utils.ts` · `stdin.ts`

**Other**: `action.yml` · `index.cjs` (GitHub Action) · `templates/` · `src/constants.ts` · `tests/setup.ts` · `CHANGELOG.md`

@./CONTRIBUTING.md

## Conventions

- ESM with `.js` import extensions · Tests in `tests/` (mirrors `src/`) · Setup: `tests/setup.ts`
- `unknown` over `any` · Conventional commits (`feat:`, `fix:`, `refactor:`)
- Dev: `next` branch · Stable: `master` · Node >= 20
- Config: `~/.agentic-setup/config.json` (mode `0600`) · Constants: `src/constants.ts`
- `package.json` scripts: `build`, `dev`, `test`, `lint`, `lint:fix`, `format`, `format:check`

## Key Patterns

- **Providers**: implement `LLMProvider` from `src/llm/types.ts` (`call()`, `stream()`)
- **Writers**: `src/writers/claude/index.ts` · `src/writers/cursor/index.ts` · `src/writers/codex/index.ts` · `src/writers/opencode/index.ts` each return `string[]`
- **Scoring**: checks in `src/scoring/checks/` return `Check[]`, constants in `src/scoring/constants.ts`
- **No hardcoded mappings**: detection is LLM-driven via `src/ai/detect.ts`
- `collectFingerprint()` in `src/fingerprint/index.ts` — async with LLM enrichment
- `resolveCliBinary()` from `src/lib/resolve-cli.ts` for CLI binary resolution
- Cursor provider: `agent --print --trust --workspace /tmp` in `src/llm/cursor-acp.ts`
- `getFastModel()` in `src/llm/config.ts`: `ANTHROPIC_SMALL_FAST_MODEL` scoped to anthropic/vertex
- `validateModel()` skips seat-based providers (`isSeatBased()` in `src/llm/types.ts`)
- Scoring: deterministic, no LLM · Backups via `src/writers/backup.ts`
- Scanner: `src/scanner/index.ts` detects local MCP servers, rules, skills for state comparison
- MCP server workspace: `packages/mcp-server/` · Config discovery: `src/lib/config-discovery.ts`
- Builtin skills (`src/lib/builtin-skills.ts`): `find-skills`, `save-learning`, `setup-agentic`

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
  2. Run: `agentic-setup refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md AGENTIC_LEARNINGS.md .agents/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what agentic-setup updated. Then proceed with the commit.

If `agentic-setup` is not found, tell the user: "This project uses agentic-setup for agent config sync. Run /setup-agentic to get set up."
<!-- /agentic:managed:pre-commit -->

<!-- agentic:managed:learnings -->
## Session Learnings

Read `AGENTIC_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /agentic:managed:learnings -->

<!-- agentic:managed:sync -->
## Context Sync

This project uses [agentic-setup](https://github.com/arpit-pm1/agentic-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `agentic-setup refresh`.
If the pre-commit hook is not set up, run `/setup-agentic` to configure everything automatically.
<!-- /agentic:managed:sync -->
