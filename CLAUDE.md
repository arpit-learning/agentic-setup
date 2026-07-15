# agentic-setup

CLI tool to keep AI agent configs in sync with your codebase.

## Commands

```bash
pnpm run build
```

```bash
pnpm run dev
```

```bash
pnpm run test
```

```bash
pnpm run lint
```

```bash
pnpm exec tsc --noEmit
```

## Architecture
- **Entry**: `src/bin.ts` · `src/cli.ts`
- **Commands** (`src/commands/`): `init.ts` · `score.ts` · `refresh.ts` · `config.ts` · `hooks.ts` · `insights.ts` · `learn.ts` · `sources.ts` · `publish.ts` · `undo.ts` · `status.ts` · `doctor.ts` · `codegraph.ts` · `analyze.ts` · `composite-score.ts`
- **LLM** (`src/llm/`): `anthropic.ts` · `vertex.ts` · `openai-compat.ts` · `cursor-acp.ts` · `claude-cli.ts` · `antigravity.ts` · `minimax.ts` · `types.ts` · `config.ts`
- **AI** (`src/ai/`): `generate.ts` · `refine.ts` · `refresh.ts` · `detect.ts` · `learn.ts` · `score-refine.ts`
- **Scoring** (`src/scoring/`): `index.ts` · Checks (`src/scoring/checks/`): `existence.ts` · `quality.ts` · `grounding.ts` · `accuracy.ts` · `freshness.ts` · `bonus.ts` · `sources.ts`
- **Writers** (`src/writers/`): `index.ts` · `claude/index.ts` · `cursor/index.ts` · `codex/index.ts` · `opencode/index.ts` · `github-copilot/index.ts` · `refresh.ts` · `staging.ts` · `backup.ts`
- **MCP**: uses `codegraph` MCP server configured in `.agents/codegraph.json`
- **Workspace Configs**: `.vscode/` (contains `mcp.json`) · `.windsurf/` (contains `mcp.json`) · `.idea/` (contains `mcp.json`) · `.devin/` (contains `mcp.json`) · `.gemini/` (contains `config`, `rules`)
- **Workflows & Docs**: `.github/` (contains `ISSUE_TEMPLATE`, `instructions`, `workflows`, `copilot-instructions.md`, `dependabot.yml`) · `.husky/` (contains `_`, `pre-commit`) · `docs/` (contains `SCORING.md`)

@./CONTRIBUTING.md
@./run.md

## Conventions
- Relative imports must use `.js` extension (even in `.ts` files)
- Use `unknown` instead of `any` for type safety
- Providers must implement `LLMProvider` in `src/llm/types.ts`
- Run `agentic-setup refresh` before commit if no hook

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
  2. Run: `agentic-setup refresh && git add AGENTIC_LEARNINGS.md .agentic-setup/score.json .agentic-setup/score-history.jsonl CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md .agents/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what agentic-setup updated. Then proceed with the commit.

**Valid `agentic-setup refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`agentic-setup config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `agentic-setup` is not found, tell the user: "This project uses agentic-setup for agent config sync. Run `npx agentic-setup setup` in your terminal (~1–2 min)."
<!-- /agentic:managed:pre-commit -->

<!-- agentic:managed:learnings -->
## Session Learnings

Read `AGENTIC_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /agentic:managed:learnings -->

<!-- agentic:managed:model-config -->
## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `AGENTIC_SETUP_MODEL` when using agentic-setup with an API provider) so upstream default changes do not silently change behavior.

<!-- /agentic:managed:model-config -->

<!-- agentic:managed:sync -->
## Context Sync

This project uses [agentic-setup](https://github.com/arpit-pm1/agentic-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `agentic-setup refresh`.
If the pre-commit hook is not set up, run `npx agentic-setup setup` in your terminal.
<!-- /agentic:managed:sync -->
