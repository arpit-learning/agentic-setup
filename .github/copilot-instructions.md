# agentic-setup

## What Is This

`@arpit-pm1/agentic-setup` — CLI that scores, generates, and syncs AI agent configs. Writes `CLAUDE.md`, `.cursor/rules/`, `AGENTS.md`, `.github/copilot-instructions.md`, and `.github/instructions/` via `src/writers/`. Supports Anthropic, Vertex AI, OpenAI-compatible APIs, and seat-based providers (`cursor`, `claude-cli`, `opencode`) in `src/llm/`.

## Commands

```bash
npm run build
npm run dev
npm run test
npm run lint
npx tsc --noEmit
npx vitest run tests/scoring/accuracy.test.ts
```

```bash
npm run ci:check
agentic-setup check
agentic-setup score --compare main
```

```bash
agentic-setup setup --auto-approve --agent github-copilot
agentic-setup refresh
agentic-setup config
```

## Architecture

**Entry**: `src/bin.ts` → `src/cli.ts` (Commander.js) · **Build**: `tsdown.config.ts` → `dist/` · **Test**: `vitest.config.ts` · **Lint**: `eslint.config.js` · **Types**: `tsconfig.json`

**Commands** (`src/commands/`): `init.ts` · `setup.ts` · `score.ts` · `refresh.ts` · `regenerate.ts` · `config.ts` · `hooks.ts` · `learn.ts` · `insights.ts` · `sources.ts` · `publish.ts` · `undo.ts` · `status.ts` · `uninstall.ts` · `doctor.ts` · `check.ts` · `ci.ts` · `analyze.ts` · `codegraph.ts` · `composite-score.ts` · Helpers: `init-helpers.ts` · `init-prompts.ts` · `init-display.ts` · `setup-files.ts` · `interactive-provider-setup.ts`

**LLM** (`src/llm/`): `index.ts` · `anthropic.ts` · `vertex.ts` · `openai-compat.ts` · `minimax.ts` · `cursor-acp.ts` · `claude-cli.ts` · `opencode.ts` · `types.ts` · `config.ts` · `utils.ts` · `usage.ts` · `model-recovery.ts` · `seat-based-errors.ts` · `preflight.ts`

**AI** (`src/ai/`): `generate.ts` · `refine.ts` · `refresh.ts` · `detect.ts` · `learn.ts` · `score-refine.ts` · `prompts.ts` · `stream-parser.ts` · `run-md.ts` · `index.ts`

**Fingerprint** (`src/fingerprint/`): `index.ts` · `file-tree.ts` · `code-analysis.ts` · `existing-config.ts` · `sources.ts` · `git.ts` · `cache.ts` · `large-file-scan.ts` · `large-file-filter.ts` · `large-file-warn.ts`

**Scoring** (`src/scoring/`): `index.ts` · `display.ts` · `markdown.ts` · `constants.ts` · `utils.ts` · `history.ts` · `dismissed.ts` · `model-pinning.ts` · Checks (`src/scoring/checks/`): `existence.ts` · `quality.ts` · `grounding.ts` · `accuracy.ts` · `freshness.ts` · `bonus.ts` · `sources.ts`

**Writers** (`src/writers/`): `index.ts` · `claude/index.ts` · `cursor/index.ts` · `codex/index.ts` · `opencode/index.ts` · `github-copilot/index.ts` · `refresh.ts` · `staging.ts` · `backup.ts` · `manifest.ts` · `pre-commit-block.ts` · `context-ignore.ts` · `contributing-ai.ts`

**Scanner** (`src/scanner/index.ts`): detects local `.mcp.json`, `.cursor/mcp.json` MCP servers, rules, and skills for drift comparison via `compareState()`

**Lib** (`src/lib/`): `hooks.ts` · `learning-hooks.ts` · `state.ts` · `resolve-cli.ts` · `sanitize.ts` · `notifications.ts` · `git-diff.ts` · `lock.ts` · `debug-report.ts` · `config-discovery.ts` · `terminal.ts` · `subprocess-sentinel.ts` · `project-config.ts` · `skill-content.ts` · `package-version.ts` · `readme-badges.ts`

**Utils** (`src/utils/`): `parallel-tasks.ts` · `spinner-messages.ts` · `editor.ts` · `review.ts` · `prompt.ts` · `version-check.ts` · `dependencies.ts` · `waiting-content.ts` · `windows.ts`

**Telemetry** (`src/telemetry/`): `index.ts` · `config.ts` · `events.ts` · **Learner** (`src/learner/`): `writer.ts` · `storage.ts` · `attribution.ts` · `roi.ts` · `utils.ts` · `stdin.ts`

**Extensions** (`src/extensions/`): `codegraph.ts` · `composite-score.ts` · `static-scans.ts` · **Profiles**: `src/profiles/index.ts` · **Other**: `action.yml` · `index.cjs` · `templates/` · `src/constants.ts` · `tests/setup.ts` · `docs/SCORING.md`

See `CONTRIBUTING.md` for release workflows (`.github/workflows/version-bump.yml`, `.github/workflows/publish-package.yml`) and CI gates (`.github/workflows/ci.yml`).

## Conventions

- ESM imports with `.js` extensions (even for `.ts` sources) · `unknown` over `any`
- Tests in `tests/` mirror `src/` (e.g. `tests/llm/config.test.ts` → `src/llm/config.ts`) · Global setup: `tests/setup.ts`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:` · Node `>=20.19` per `package.json`
- Branches: `main` (stable) · `beta` · `staging` per `CONTRIBUTING.md`
- User config: `~/.agentic-setup/config.json` (mode `0600`) · Project config: `.agentic-setup.yaml` via `src/lib/project-config.ts`
- Constants: `src/constants.ts` · `src/scoring/constants.ts`

## Key Patterns

- **Providers**: implement `LLMProvider` in `src/llm/types.ts` (`call()`, `stream()`, optional `listModels()`)
- **Seat-based**: `isSeatBased()` in `src/llm/types.ts` — `cursor`, `claude-cli`, `opencode` skip full `validateModel()` in `src/llm/index.ts`
- **Writers**: `writeSetup()` in `src/writers/index.ts` delegates to `src/writers/github-copilot/index.ts` (Copilot), each writer returns `string[]` of written paths
- **Scoring**: `computeLocalScore()` in `src/scoring/index.ts` — deterministic, no LLM · `filterChecksForTarget()` uses `COPILOT_ONLY_CHECKS` in `src/scoring/constants.ts`
- **Detection**: LLM-driven stack detection via `detectProjectStack()` in `src/ai/detect.ts` — no hardcoded language mappings
- **Fingerprint**: `collectFingerprint()` in `src/fingerprint/index.ts` — async with cache in `src/fingerprint/cache.ts`
- **Refresh**: `refreshDocs()` in `src/ai/refresh.ts` updates all platform docs from git diff · `writeRefreshDocs()` in `src/writers/refresh.ts`
- **Backups**: `src/writers/backup.ts` before every write · Undo via `agentic-setup undo` using `src/writers/manifest.ts`
- **MCP discovery**: `scanLocalState()` in `src/scanner/index.ts` reads `.mcp.json` (Claude) and `.cursor/mcp.json` (Cursor) · Config paths via `src/lib/config-discovery.ts`
- **Cursor provider**: `agent --print --trust --workspace /tmp` in `src/llm/cursor-acp.ts`
- **Fast model**: `getFastModel()` in `src/llm/config.ts` — `AGENTIC_SETUP_FAST_MODEL` overrides provider defaults
- **CLI resolution**: `resolveCliBinary()` from `src/lib/resolve-cli.ts`

## Scoring Rubric

Full deterministic rubric in `docs/SCORING.md`. Local audit: `agentic-setup score` · PR comment: `agentic-setup score --comment` · CI gate: `agentic-setup check`. Grades in `GRADE_THRESHOLDS` (`src/scoring/constants.ts`): A ≥ 85.

## Session Learnings

Read `AGENTIC_LEARNINGS.md` for operational patterns from prior AI sessions — treat as project-specific rules alongside this file.

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
