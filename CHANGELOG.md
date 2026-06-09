# Changelog

All notable changes to **agentic-setup** are documented here.

## 1.0.0 — 2026-06-09

First standalone release as **agentic-setup**.

### Product

- Single CLI binary: `agentic-setup`
- Runtime state under `.agentic-setup/`; global config under `~/.agentic-setup/`
- Session learnings file: `AGENTIC_LEARNINGS.md`
- Onboarding skill: `/setup-agentic`
- Auto-migration from legacy state directories on first run

### Extensions

- `agentic-setup analyze` — static analysis output under `.agentic-setup/analysis/`
- `agentic-setup codegraph setup` — Codegraph MCP wiring
- `agentic-setup readiness` / `doctor` — combined config + Codegraph readiness scoring
- Composite score field: `config_score`

### Telemetry

- PostHog **disabled by default**; opt in with `AGENTIC_SETUP_TELEMETRY=1`
- Env vars use `AGENTIC_SETUP_*` prefix

### Hooks & rules

- Managed markers: `agentic:managed:*`
- Hook scripts: `agentic-*.sh` / `agentic-*.mdc`
