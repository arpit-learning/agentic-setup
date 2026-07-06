# Changelog

## [1.0.1](https://github.com/arpit-pm1/agentic-setup/compare/v1...v1.0.1) (2026-07-06)


### Features

* introduce project context extraction and stack detection utilities to improve AI analysis capabilities ([66e48e8](https://github.com/arpit-pm1/agentic-setup/commit/66e48e814cf5306d7a13e1abac239c18fe9c28c6))

# [1.0.0](https://github.com/arpit-pm1/agentic-setup/compare/v0.0.2-alpha.1...v1.0.0) (2026-06-21)


### Features

* add --dangerously-skip-permissions option to init and setup commands ([10c581c](https://github.com/arpit-pm1/agentic-setup/commit/10c581c46b2ec253edbd6c2e9ca4f8392d07b205))
* add antigravity provider support and include markdown documentation contents in prompts ([152f35f](https://github.com/arpit-pm1/agentic-setup/commit/152f35fec03d3baf3552bedc9fb1bcf3db6ef4d0))

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
