# agentic-setup Instructions

## Commands
```bash
npm run build
npm run dev
npm run test
```

## Architecture
**Entry**: `src/bin.ts` → `src/cli.ts`
**LLM**: `src/llm/anthropic.ts` · `src/llm/vertex.ts` · `src/llm/openai-compat.ts` · `src/llm/cursor-acp.ts` · `src/llm/claude-cli.ts` · `src/llm/antigravity.ts` · `src/llm/minimax.ts` · `src/llm/types.ts` · `src/llm/config.ts`
**AI**: `src/ai/generate.ts` · `src/ai/refine.ts` · `src/ai/refresh.ts` · `src/ai/detect.ts` · `src/ai/learn.ts`
**Fingerprint**: `src/fingerprint/index.ts` · `src/fingerprint/file-tree.ts`
**Scoring**: `src/scoring/index.ts` · Checks: `checks/existence.ts` · `checks/quality.ts` · `checks/grounding.ts` · `checks/accuracy.ts` · `checks/freshness.ts`
**MCP**: uses `codegraph` MCP server configured in `.agents/codegraph.json`

## Conventions
- ESM imports require `.js` extensions.
- Providers implement `LLMProvider` in `src/llm/types.ts`.
- Pre-commit sync: run `agentic-setup refresh` if no hook active.

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
