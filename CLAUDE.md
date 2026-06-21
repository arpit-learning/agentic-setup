# agentic-setup

## What Is This
`agentic-setup` — CLI that keeps AI agent configs in sync with your codebase across Claude Code, Cursor, Codex, OpenCode, and GitHub Copilot.

## Commands
```bash
npm run build
npm run dev
npm run test
```

To run linter:
```bash
npm run lint
```

To run type checks:
```bash
npx tsc --noEmit
```

## Architecture
**Entry**: `src/bin.ts` → `src/cli.ts`
**Commands** (`src/commands/`): `init.ts` · `score.ts` · `refresh.ts` · `regenerate.ts` · `config.ts` · `hooks.ts` · `insights.ts` · `learn.ts` · `recommend.ts` · `sources.ts` · `publish.ts` · `undo.ts` · `status.ts` · `uninstall.ts` · `doctor.ts` · `codegraph.ts` · `analyze.ts` · `composite-score.ts`
**LLM** (`src/llm/`): `anthropic.ts` · `vertex.ts` · `openai-compat.ts` · `cursor-acp.ts` · `claude-cli.ts` · `antigravity.ts` · `minimax.ts` · `types.ts` · `config.ts`
**AI** (`src/ai/`): `generate.ts` · `refine.ts` · `refresh.ts` · `detect.ts` · `learn.ts` · `score-refine.ts`
**Fingerprint** (`src/fingerprint/`): `index.ts` · `file-tree.ts` · `code-analysis.ts` · `existing-config.ts` · `sources.ts` · `git.ts`
**Scoring** (`src/scoring/`): `index.ts` · `display.ts` · `constants.ts` · Checks (`src/scoring/checks/`): `existence.ts` · `quality.ts` · `grounding.ts` · `accuracy.ts` · `freshness.ts` · `bonus.ts` · `sources.ts`
**Writers** (`src/writers/`): `index.ts` · `claude/index.ts` · `cursor/index.ts` · `codex/index.ts` · `opencode/index.ts` · `github-copilot/index.ts` · `refresh.ts` · `staging.ts` · `backup.ts`
**MCP**: uses `codegraph` MCP server configured in `.agents/codegraph.json`
**Workspace Tooling**: `.vscode/` (contains: mcp.json), `.idea/` (contains: mcp.json), `.windsurf/` (contains: mcp.json), and `.devin/` (contains: mcp.json) configures workspace details.
**Hooks & CLI Settings**: Git hooks managed under `.husky/` (contains: _, pre-commit) and global options in `.gemini/` (contains: config).
**Docs & Automation**: Scoring guides in `docs/` (contains: SCORING.md) and repository helpers in `scripts/` (contains: generate-readme-badges.ts).

@./CONTRIBUTING.md
@./run.md

## Conventions
- ESM imports require `.js` extension (even for `.ts` sources)
- `unknown` over `any` · Conventional commits: `feat:`, `fix:`, `refactor:`
- Providers implement `LLMProvider` in `src/llm/types.ts`
- Run `agentic-setup refresh` before commit if no hook

<!-- agentic:managed:pre-commit -->
## Before Committing
Check if pre-commit hook is active:
`grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"`
If no-hook, run `agentic-setup refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md AGENTIC_LEARNINGS.md 2>/dev/null`
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
