# Agent Config Scoring Rubric

`agentic-setup score` evaluates AI agent configuration quality **deterministically** — no LLM calls, no network. It cross-references config files (`CLAUDE.md`, `.cursor/rules/`, `AGENTS.md`, etc.) against your project filesystem and git history.

The final score is **normalized to 0–100** based on checks that apply to your selected agent target(s). Only relevant checks are included in the denominator.

## Grade scale

Config score and combined readiness use the **same grade thresholds**:

| Grade | Minimum score | Meaning |
|-------|---------------|---------|
| **A** | 85 | Production-ready agent context |
| **B** | 70 | Solid; minor gaps remain |
| **C** | 55 | Usable but needs improvement |
| **D** | 40 | Significant gaps |
| **F** | 0  | Missing or broken config |

## How the score is calculated

```
score = round(earnedPoints / maxPossiblePoints × 100)
```

- **Earned points** — sum of points from passing and partial checks
- **Max possible** — sum of `maxPoints` for all applicable checks (after target filtering and dismissed checks)
- Checks with `maxPoints: 0` do not affect the denominator (see **Optional checks** below)

## Combined readiness (`agentic-setup check`)

PR comments and `score --comment` also show **readiness** — a weighted blend used by `agentic-setup check`:

```
readiness = config_score × 70% + extension_score × 30%
```

Extensions cover Codegraph indexing, lint, security scans, and test coverage ratio. Readiness uses the same A–F grade scale as config score (see above).

## Categories

| Category | Typical max | What it measures |
|----------|-------------|------------------|
| **Files & Setup** | 25 | Required config files exist, MCP servers, cross-platform parity |
| **Quality** | 25 | Executable commands, token budget, concrete instructions, structure |
| **Grounding** | 20 | Config references real project paths and directories |
| **Accuracy** | 15 | Referenced paths exist; config freshness vs. git drift |
| **Freshness & Safety** | 10 | Recent updates, no leaked secrets, permissions configured |
| **Bonus** | 11+ | Hooks, skills, learnings, model pinning, `run.md`, external sources |

---

## Checks by category

### Files & Setup (existence)

| Check ID | Points | Pass criteria | Agents |
|----------|--------|---------------|--------|
| `claude_md_exists` | 6 | `CLAUDE.md` at repo root | Claude |
| `claude_rules_exist` | 3 | `.claude/rules/*.md` present | Claude |
| `cursor_rules_exist` | 3 | `.cursorrules` or `.cursor/rules/` | Cursor |
| `cursor_mdc_rules` | 3 | At least one `.cursor/rules/*.mdc` | Cursor |
| `mcp_servers` | 3 | MCP servers in `.mcp.json`, `.cursor/mcp.json`, or Claude settings | All (optional — see below) |
| `cross_platform_parity` | 2 | Both Claude and Cursor configs present | Claude + Cursor |
| `codex_agents_md_exists` | 6 | `AGENTS.md` at repo root | Codex / OpenCode / Antigravity |
| `copilot_instructions_exists` | 6 | `.github/copilot-instructions.md` **or** `.github/instructions/*.md` | GitHub Copilot |
| `opencode_config_exists` | 6 | `.opencode/` directory present | OpenCode |
| `antigravity_config_exists` | 6 | `.gemini/` directory present | Antigravity IDE |

### Quality

| Check ID | Points | Pass criteria |
|----------|--------|---------------|
| `has_executable_content` | 8 | Graduated: 3+ blocks = full points; 2 = 6; 1 = 3 |
| `concise_config` | 6 | Graduated by total tokens: ≤5k = 6; ≤8k = 5; ≤12k = 4; ≤16k = 2; ≤24k = 1 |
| `concreteness` | 4 | Ratio of concrete vs abstract lines (≥70% = full) |
| `no_directory_tree` | 3 | No large ASCII tree listings in config |
| `no_duplicate_content` | 2 | No significant duplication across config files | Claude + Cursor |
| `has_structure` | 2 | Markdown headings and sections present |
| `agents_md_spec` | 3 | Setup, Testing, Conventions sections in AGENTS.md | When `AGENTS.md` exists |

### Grounding

| Check ID | Points | Pass criteria |
|----------|--------|---------------|
| `project_grounding` | 12 | Config references actual project directories/files (graduated by coverage ratio) |
| `reference_density` | 8 | Sufficient backtick paths and file references (graduated) |

### Accuracy

| Check ID | Points | Pass criteria |
|----------|--------|---------------|
| `references_valid` | 8 | Graduated by % of referenced paths that exist on disk |
| `config_drift` | 7 | Config updated recently relative to code changes (git-based) |

### Freshness & Safety

| Check ID | Points | Pass criteria |
|----------|--------|---------------|
| `claude_md_freshness` | 4 | Config updated within N commits of latest code (graduated) | Claude |
| `no_secrets` | 4 | No API keys, tokens, or credentials in config files (negative points if found) |
| `permissions_configured` | 2 | Claude settings include permission rules |

### Bonus

| Check ID | Points | Pass criteria |
|----------|--------|---------------|
| `hooks_configured` | 2 | Pre-commit or Claude session hooks for auto-refresh |
| `agents_md_exists` | 1 | Cross-agent compatibility file | Non-Codex / non-OpenCode |
| `learned_content` | 2 | Actionable items in `AGENTIC_LEARNINGS.md` |
| `skills_configured` | 2 | Valid skill dirs with `SKILL.md` under `.claude/skills/`, `.cursor/skills/`, `.agents/skills/`, or `.opencode/skills/` |
| `model_pinned` | 2 | Model/effort explicitly set in config or env |
| `run_md_present` | 2 | `run.md` with startup command, base URL, health endpoint |
| `sources_configured` | 3 | `.agentic-setup/sources.json` present | Conditional |
| `sources_referenced` | 3 | Config mentions configured external sources | Conditional |

---

## Target agent filtering

When you run `agentic-setup score --agent claude,cursor`, only checks relevant to those platforms are scored:

- **Claude-only** — `claude_md_exists`, `claude_rules_exist`, `claude_md_freshness`
- **Cursor-only** — `cursor_rules_exist`, `cursor_mdc_rules`
- **Codex-only** — `codex_agents_md_exists` (also applies when OpenCode or Antigravity is a target)
- **OpenCode-only** — `opencode_config_exists`
- **Antigravity-only** — `antigravity_config_exists`
- **Copilot-only** — `copilot_instructions_exists`
- **Both-only** — `cross_platform_parity`, `no_duplicate_content` (requires Claude + Cursor)
- **Non-Codex** — `agents_md_exists` bonus excluded for Codex, OpenCode, and Antigravity targets

Auto-detection uses files on disk if `--agent` is omitted.

## Optional checks

Some checks are **excluded from scoring** when their prerequisite is not met:

| Check | Behavior when optional |
|-------|------------------------|
| `mcp_servers` | If no MCP config files exist, `maxPoints` is set to **0** — the check is omitted from the denominator (teams without MCP are not penalized) |
| `sources_configured` / `sources_referenced` | Only counted when `.agentic-setup/sources.json` lists external sources |

## AGENTS.md spec scope

`agents_md_spec` runs whenever **`AGENTS.md` exists**, regardless of target agent. A Claude-only repo that also has `AGENTS.md` for cross-agent compatibility will be scored on Setup / Testing / Conventions sections — not only Codex-targeted repos.

## Partial credit

Many checks award **graduated points** (e.g. 4/8 for references). These appear as partial credit in PR comments and terminal output with recovery hints (`↑ Fix this for +N more points`).

## Dismissing checks

Checks can be dismissed per-project (stored in `.agentic-setup/dismissed-checks.json`). Dismissed checks are excluded from scoring entirely.

```bash
agentic-setup score --dismiss mcp_servers --reason "Team does not use MCP"
```

## CI and PR comments

- **`agentic-setup check`** — fails when config score or combined readiness is below thresholds in `.agentic-setup.yaml`
- **PR workflow** — posts a comment with config score, category breakdown, readiness (70/30 blend), top improvements, failing/partial checks, and a link to this rubric
- **`agentic-setup score --compare main`** — shows score delta vs. a git ref; `--comment` adds per-category deltas when categories change

## Commands

```bash
agentic-setup score                    # Full terminal breakdown
agentic-setup score --json             # Machine-readable output
agentic-setup score --compare staging  # Delta vs. branch
agentic-setup score --compare staging --comment  # PR comment markdown (includes readiness)
agentic-setup score --agent claude     # Score for Claude target only
```

## Related thresholds (`.agentic-setup.yaml`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `config_score_threshold` | 60 | Minimum config score for `check` / CI (grade C) |
| `readiness_threshold` | 60 | Minimum combined readiness % (config + extensions) |

Grade **A (≥85)** is marketed as production-ready; consider raising thresholds to **70 (grade B)** for stricter CI gates.

---

*Scoring constants live in `src/scoring/constants.ts`. Check implementations in `src/scoring/checks/`.*
