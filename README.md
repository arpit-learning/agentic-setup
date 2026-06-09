# agentic-setup

**Hand-written `CLAUDE.md` files go stale the moment you refactor.** Your AI agent hallucinates paths that no longer exist, misses new dependencies, and gives advice based on yesterday's architecture. agentic-setup generates and maintains your AI context files (`CLAUDE.md`, `.cursor/rules/`, `AGENTS.md`, `copilot-instructions.md`) so they stay accurate as your code evolves — and keeps every agent on your team in sync, whether they use Claude Code, Cursor, Codex, OpenCode, or GitHub Copilot.

<p align="center">
  <img src="assets/demo-header.gif" alt="agentic-setup product demo" width="900">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentic-setup"><img src="https://img.shields.io/npm/v/agentic-setup" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/agentic-setup" alt="license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/agentic-setup" alt="node"></a>
  <img src="https://img.shields.io/badge/config-94%2F100-brightgreen" alt="agentic-setup Score">
  <img src="https://img.shields.io/badge/Claude_Code-supported-blue" alt="Claude Code">
  <img src="https://img.shields.io/badge/Cursor-supported-blue" alt="Cursor">
  <img src="https://img.shields.io/badge/Codex-supported-blue" alt="Codex">
  <img src="https://img.shields.io/badge/OpenCode-supported-blue" alt="OpenCode">
  <img src="https://img.shields.io/badge/GitHub_Copilot-supported-blue" alt="GitHub Copilot">
</p>

## Before / After

Most repos start with a hand-written `CLAUDE.md` and nothing else. Here's what agentic-setup finds — and fixes:

```
  Before                                    After agentic-setup setup
  ──────────────────────────────            ──────────────────────────────

  Agent Config Score    35 / 100            Agent Config Score    94 / 100
  Grade D                                   Grade A

  FILES & SETUP           6 / 25            FILES & SETUP          24 / 25
  QUALITY                12 / 25            QUALITY                22 / 25
  GROUNDING               7 / 20            GROUNDING              19 / 20
  ACCURACY                5 / 15            ACCURACY               13 / 15
  FRESHNESS               5 / 10            FRESHNESS              10 / 10
  BONUS                   0 / 9             BONUS                   7 / 9
```

Scoring is deterministic — no LLM, no API calls. It cross-references your config files against your actual project filesystem: do referenced paths exist? Are code blocks present? Is there config drift since your last commit?

```bash
agentic-setup score --compare main    # See how your branch changed the score
```

## Get Started

Requires **Node.js >= 20**.

```bash
npx agentic-setup setup --auto-approve --agent claude,cursor
```

This runs the full onboarding pipeline: hooks, config generation, Codegraph, analyze, and readiness checks. Works with any LLM provider — bring your own Anthropic, OpenAI, or Vertex AI key, or use Claude Code / Cursor subscription when available.

**Prefer step-by-step?** Run `agentic-setup init` for the interactive wizard with review before each write.

**CI / pre-push gate:**

```bash
agentic-setup check          # exit 0 = pass
agentic-setup check --json   # for GitHub Actions
```

**Project config** (`.agentic-setup.yaml` at repo root): agents, stack profile, readiness thresholds, Codegraph/analyze toggles, `run.md` generation, and optional CI workflow.

> **Your code stays on your machine.** Scoring and doctor checks are 100% local. Generation uses your own AI subscription or API key. agentic-setup never sees your code.

<details>
<summary><strong>Windows Users</strong></summary>

agentic-setup works on Windows with a few notes:

- **Run from your terminal** (PowerShell, CMD, or Git Bash) — not from inside an IDE chat window. Open a terminal, `cd` into your project folder, then run `npx agentic-setup setup`.
- **Git Bash is recommended.** agentic-setup's pre-commit hooks and auto-sync scripts use shell syntax. Git for Windows includes Git Bash, which handles this automatically. If you only use PowerShell, hooks may be skipped silently.
- **Cursor Agent CLI:** If prompted to install it, download from [cursor.com/downloads](https://www.cursor.com/downloads) instead of the `curl | bash` command shown on macOS/Linux. Then run `agent login` in your terminal to authenticate.
- **One terminal at a time.** Avoid running agentic-setup from multiple terminals simultaneously — this can cause conflicting state and unexpected provider detection.

</details>

## Audits first, writes second

agentic-setup never overwrites your existing configs without asking. The workflow mirrors code review:

1. **Score** — read-only audit of your current setup
2. **Propose** — generate or improve configs, shown as a diff
3. **Review** — accept, refine via chat, or decline each change
4. **Backup** — originals saved to `.agentic-setup/backups/` before every write
5. **Undo** — `agentic-setup undo` restores everything to its previous state

If your existing config scores **95+**, agentic-setup skips full regeneration and applies targeted fixes to the specific checks that are failing.

## How It Works

Run `agentic-setup setup` once in your terminal. It analyzes your project — languages, frameworks, dependencies, architecture — generates configs, and installs hooks. From there, it's a loop:

```
  npx agentic-setup setup           ← one-time onboarding
              │
              ▼
  ┌──── configs generated ◄────────────┐
  │           │                        │
  │           ▼                        │
  │     your code evolves              │
  │     (new deps, renamed files,      │
  │      changed architecture)         │
  │           │                        │
  │           ▼                        │
  └──► agentic-setup refresh ──────────────►─┘
       (auto, on every commit)
```

Pre-commit hooks run the refresh loop automatically. New team members are nudged to run `agentic-setup setup` on their first session.

### What It Generates

**All repos**
- `.agentic-setup.yaml` — Project config (agents, profile, thresholds)
- `run.md` — Local startup, health URL, and test commands (when detection succeeds)
- `.cursorignore` / `.agentic-setupignore` — Context boundaries for agents
- `.agentic-setup/` — Backups, analysis artifacts, manifest, state

**Claude Code**
- `CLAUDE.md` — Project context, build/test commands, architecture, conventions
- `.claude/rules/*.md` — Path-scoped rules with YAML frontmatter
- `AGENTIC_LEARNINGS.md` — Patterns learned from your AI coding sessions
- `.mcp.json` — Auto-discovered MCP server configurations
- `.claude/settings.json` — Permissions and hooks

**Cursor**
- `.cursor/rules/*.mdc` — Rules with frontmatter (description, globs, alwaysApply)
- `.cursor/mcp.json` — MCP server configurations

**OpenAI Codex / OpenCode**
- `AGENTS.md` — Project context (shared when both Codex and OpenCode are targeted)

**GitHub Copilot**
- `.github/copilot-instructions.md` — Project context for Copilot
- `.github/instructions/*.instructions.md` — Path-scoped instruction files

## Key Features

<details>
<summary><strong>Any Codebase</strong></summary>

TypeScript, Python, Go, Rust, Java, Ruby, Terraform, and more. Language and framework detection is fully LLM-driven — no hardcoded mappings. agentic-setup works on any project.

</details>

<details>
<summary><strong>Any AI Tool</strong></summary>

`agentic-setup setup` and `agentic-setup init` auto-detect which agents you have installed. For manual control:
```bash
agentic-setup init --agent claude        # Claude Code only
agentic-setup init --agent cursor        # Cursor only
agentic-setup init --agent codex         # Codex only
agentic-setup init --agent opencode        # OpenCode only
agentic-setup init --agent github-copilot  # GitHub Copilot only
agentic-setup init --agent all             # All platforms
agentic-setup init --agent claude,cursor   # Comma-separated
```

</details>

<details>
<summary><strong>Chat-Based Refinement</strong></summary>

Not happy with the generated output? During review, refine via natural language — describe what you want changed and agentic-setup iterates until you're satisfied.

</details>

<details>
<summary><strong>MCP Server Discovery</strong></summary>

agentic-setup detects the tools your project uses (databases, APIs, services) and auto-configures matching MCP servers for Claude Code and Cursor.

</details>

<details>
<summary><strong>Codegraph + Readiness</strong></summary>

- `agentic-setup codegraph setup` — MCP wiring + symbol index
- `agentic-setup analyze` — lint/security/test ratio snapshot in `.agentic-setup/analysis/`
- `agentic-setup readiness` — combined config score + extension readiness
- `agentic-setup doctor` / `agentic-setup check` — health gate for local dev and CI

</details>

<details>
<summary><strong>run.md + Stack Profiles</strong></summary>

Init generates `run.md` (startup command, health URL, test command) so agents know how to run the app locally. Stack profiles (`api-only`, `ui-feature`, `java-service`, `python-api`) tune generation via `.agentic-setup.yaml`.

</details>

<details>
<summary><strong>Deterministic Scoring</strong></summary>

`agentic-setup score` evaluates your config quality without any LLM calls — purely by cross-referencing config files against your actual project filesystem.

| Category | Points | What it checks |
|---|---|---|
| **Files & Setup** | 25 | Config files exist, MCP servers, cross-platform parity, rules |
| **Quality** | 25 | Code blocks, concise token budget, concrete instructions, structured headings |
| **Grounding** | 20 | Config references actual project directories and files |
| **Accuracy** | 15 | Referenced paths exist on disk, config freshness vs. git history |
| **Freshness & Safety** | 10 | Recently updated, no leaked secrets, permissions configured |
| **Bonus** | 9+ | Hooks, learnings, model pinning, `run.md`, external sources |

**Grades:** A ≥ 85 · B ≥ 70 · C ≥ 55 · D ≥ 40 · F &lt; 40

See the full rubric — every check, point value, and pass criteria — in **[docs/SCORING.md](docs/SCORING.md)**.

Every failing check includes structured fix data — when `agentic-setup init` runs, the LLM receives exactly what's wrong and how to fix it. PR comments include a category breakdown, top improvements, and partial vs failing checks.

</details>

<details>
<summary><strong>Session Learning</strong></summary>

agentic-setup watches your AI coding sessions and learns from them. Hooks capture tool usage, failures, and your corrections — then an LLM distills operational patterns into `AGENTIC_LEARNINGS.md`.

```bash
agentic-setup learn install      # Install hooks for Claude Code and Cursor
agentic-setup learn status       # View hook status, event count, and ROI summary
agentic-setup learn finalize     # Manually trigger analysis (auto-runs on session end)
agentic-setup learn remove       # Remove hooks
```

Learned items are categorized by type — **[correction]**, **[gotcha]**, **[fix]**, **[pattern]**, **[env]**, **[convention]** — and automatically deduplicated.

</details>

<details>
<summary><strong>Auto-Refresh</strong></summary>

Keep configs in sync with your codebase automatically:

| Hook | Trigger | What it does |
|---|---|---|
| **Git pre-commit** | Before each commit | Refreshes docs and stages updated files |
| **Claude Code session end** | End of each session | Runs `agentic-setup refresh` and updates docs |
| **Learning hooks** | During each session | Captures events for session learning |

```bash
agentic-setup hooks --install    # Enable refresh hooks
agentic-setup hooks --remove     # Disable refresh hooks
```

The `refresh` command analyzes your git diff (committed, staged, and unstaged changes) and updates config files to reflect what changed.

</details>

<details>
<summary><strong>Team Onboarding</strong></summary>

When agentic-setup is set up in a repo, it automatically nudges new team members to configure it on their machine. A lightweight session hook checks whether the pre-commit hook is installed and prompts them to run `npx agentic-setup setup` in their terminal — no manual coordination needed.

</details>

<details>
<summary><strong>Fully Reversible</strong></summary>

- **Automatic backups** — originals saved to `.agentic-setup/backups/` before every write
- **Score regression guard** — if a regeneration produces a lower score, changes are auto-reverted
- **Full undo** — `agentic-setup undo` restores everything to its previous state
- **Clean uninstall** — `agentic-setup uninstall` removes everything agentic-setup added (hooks, generated sections, learnings) while preserving your own content
- **Dry run** — preview changes with `--dry-run` before applying

</details>

## `.agentic-setup.yaml`

Written on first `init` or `setup`. Controls agents, stack profile, thresholds, and optional automation:

```yaml
version: 1
agents: [claude, cursor]
profile: auto          # auto | api-only | ui-feature | java-service | python-api
codegraph: true
analyze_on_setup: true
readiness_threshold: 60
config_score_threshold: 80
ignore:
  - vendor/
run:
  generate: true       # create run.md if missing
ci:
  workflow: true       # write .github/workflows/agentic-sync.yml
```

## Commands

Run `agentic-setup --help` for the full list. agentic-setup is **CLI-only** — onboard with `setup` or `init` from your terminal (no chat skills or `bootstrap`).

### Onboarding and config

| Command | Description |
|---|---|
| `agentic-setup setup` | Full pipeline: hooks → init → codegraph → analyze → readiness → doctor |
| `agentic-setup init` | Interactive wizard — analyze, generate, review, install hooks |
| `agentic-setup config` | Configure LLM provider, API key, and model |
| `agentic-setup regenerate` | Re-analyze and regenerate configs (aliases: `regen`, `re`) |
| `agentic-setup undo` | Revert changes from the last run (uses `.agentic-setup/backups/`) |
| `agentic-setup uninstall` | Remove all agentic-setup resources from the project |

**Common flags:** `--agent claude,cursor` · `--auto-approve` · `--dry-run` · `--skip-llm` · `--skip-codegraph`

### Sync and quality

| Command | Description |
|---|---|
| `agentic-setup refresh` | Update agent docs from recent code changes |
| `agentic-setup hooks --install` | Enable pre-commit / session refresh hooks |
| `agentic-setup hooks --remove` | Disable hooks |
| `agentic-setup score` | Config quality score (deterministic, no LLM) |
| `agentic-setup score --compare <ref>` | Score delta vs. a git branch, tag, or SHA |
| `agentic-setup score --comment` | PR comment markdown with category breakdown |
| `agentic-setup status` | Setup status, CLI version pin, profile, drift |

### Extensions and CI

| Command | Description |
|---|---|
| `agentic-setup check` | CI gate — doctor + score + readiness (exit 1 on failure) |
| `agentic-setup doctor` | Health checks — hooks, MCP, `run.md`, analysis freshness |
| `agentic-setup analyze` | Lint/security/test snapshot → `.agentic-setup/analysis/` |
| `agentic-setup readiness` | Combined config score + extension readiness % |
| `agentic-setup codegraph setup` | Wire Codegraph MCP + build symbol index |
| `agentic-setup ci init` | Add GitHub Actions workflow for `agentic-setup check` |

### Learning and context

| Command | Description |
|---|---|
| `agentic-setup learn install` | Session learning hooks (Claude Code / Cursor) |
| `agentic-setup learn status` | Hook status, event count, ROI summary |
| `agentic-setup learn list` | List learnings in `AGENTIC_LEARNINGS.md` |
| `agentic-setup learn finalize` | Manually run session analysis |
| `agentic-setup insights` | Agent performance and learning impact |
| `agentic-setup sources list` | External context sources (related repos/docs) |
| `agentic-setup sources add <path>` | Add an external source |
| `agentic-setup publish` | Machine-readable summary for other repos |

## FAQ

<details>
<summary><strong>Does it overwrite my existing configs?</strong></summary>

No. agentic-setup shows you a diff of every proposed change. You accept, refine, or decline each one. Originals are backed up automatically.

</details>

<details>
<summary><strong>Does it need an API key?</strong></summary>

**Scoring & check:** No. Both run 100% locally with no LLM.

**Generation** (via `agentic-setup setup` or `agentic-setup init`): Uses your existing Claude Code or Cursor subscription (no API key needed), or bring your own key for Anthropic, OpenAI, or Vertex AI.

</details>

<details>
<summary><strong>What's the difference between setup and init?</strong></summary>

`agentic-setup setup` runs the full onboarding pipeline non-interactively (hooks, init with auto-approve, Codegraph, analyze, readiness). `agentic-setup init` is the interactive wizard with review before each write. Both produce the same end state.

</details>

<details>
<summary><strong>What if I don't like what it generates?</strong></summary>

Refine it via chat during review, or decline the changes entirely. If you already accepted, `agentic-setup undo` restores everything. You can also preview with `--dry-run`.

</details>

<details>
<summary><strong>Does it work with monorepos?</strong></summary>

Yes. Run `agentic-setup init` from any directory. `agentic-setup refresh` can update configs across multiple repos when run from a parent directory.

</details>

<details>
<summary><strong>Does it send my code anywhere?</strong></summary>

Scoring is fully local. Generation sends a project summary (languages, structure, dependencies — not source code) to whatever LLM provider you configure — the same provider your AI editor already uses. Anonymous usage analytics (command names, durations — no code, no file contents) are collected via PostHog. To opt out:

- **Per-run**: `agentic-setup --no-traces <command>`
- **Persistent env var**: `export AGENTIC_SETUP_TELEMETRY_DISABLED=1`

</details>

## LLM Providers

No API key? No problem. agentic-setup works with your existing AI tool subscription:

| Provider | Setup | Default Model |
|---|---|---|
| **Claude Code** (your seat) | `agentic-setup config` → Claude Code | Inherited from Claude Code |
| **Cursor** (your seat) | `agentic-setup config` → Cursor | Inherited from Cursor |
| **Anthropic** | `export ANTHROPIC_API_KEY=sk-ant-...` | `claude-sonnet-4-6` |
| **OpenAI** | `export OPENAI_API_KEY=sk-...` | `gpt-5.4-mini` |
| **Vertex AI** | `export VERTEX_PROJECT_ID=my-project` | `claude-sonnet-4-6` |
| **Custom endpoint** | `OPENAI_API_KEY` + `OPENAI_BASE_URL` | `gpt-5.4-mini` |

Override the model for any provider: `export AGENTIC_SETUP_MODEL=<model-name>` or use `agentic-setup config`.

agentic-setup uses a **two-tier model system** — lightweight tasks (classification, scoring) auto-use a faster model, while heavy tasks (generation, refinement) use the default. This keeps costs low and speed high.

Configuration is stored in `~/.agentic-setup/config.json` with restricted permissions (`0600`). API keys are never written to project files.

<details>
<summary>Vertex AI advanced setup</summary>

```bash
# Custom region
export VERTEX_PROJECT_ID=my-gcp-project
export VERTEX_REGION=europe-west1

# Service account credentials (inline JSON)
export VERTEX_PROJECT_ID=my-gcp-project
export VERTEX_SA_CREDENTIALS='{"type":"service_account",...}'

# Service account credentials (file path)
export VERTEX_PROJECT_ID=my-gcp-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

</details>

<details>
<summary>Environment variables reference</summary>

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_BASE_URL` | Custom OpenAI-compatible endpoint |
| `VERTEX_PROJECT_ID` | GCP project ID for Vertex AI |
| `VERTEX_REGION` | Vertex AI region (default: `us-east5`) |
| `VERTEX_SA_CREDENTIALS` | Service account JSON (inline) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON file path |
| `AGENTIC_SETUP_USE_CLAUDE_CLI` | Use Claude Code CLI (`1` to enable) |
| `AGENTIC_SETUP_USE_CURSOR_SEAT` | Use Cursor subscription (`1` to enable) |
| `AGENTIC_SETUP_MODEL` | Override model for any provider |
| `AGENTIC_SETUP_FAST_MODEL` | Override fast model for any provider |

</details>

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

```bash
git clone git@github.com:arpit-pm1/agentic-setup.git
cd agentic-setup
npm install
npm run dev      # Watch mode
npm run test     # Run tests
npm run build    # Compile
```

Uses [conventional commits](https://www.conventionalcommits.org/) — `feat:` for features, `fix:` for bug fixes.

## Add a agentic-setup badge to your repo

After scoring your project, add a badge to your README:

![agentic-setup Score](https://img.shields.io/badge/config-94%2F100-brightgreen)

Copy this markdown and replace `94` with your actual score:

```
![agentic-setup Score](https://img.shields.io/badge/config-SCORE%2F100-COLOR)
```

Color guide: `brightgreen` (90+), `green` (70-89), `yellow` (40-69), `red` (<40).

## License

MIT
