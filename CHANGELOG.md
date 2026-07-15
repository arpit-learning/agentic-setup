# Changelog

## [1.0.5](https://github.com/arpit-pm1/agentic-setup/compare/v1...v1.0.5) (2026-07-13)


### Features

* add interactive prompts to configure Java version and JDK distribution for CI workflows ([d57bb35](https://github.com/arpit-pm1/agentic-setup/commit/d57bb3526e2eda5b3b32a8006d0425adb275ab49))

## [1.0.4](https://github.com/arpit-pm1/agentic-setup/compare/v1...v1.0.4) (2026-07-13)


### Features

* add CI/CD workflow templates for Java, Node.js, and common repository maintenance tasks ([be3a01a](https://github.com/arpit-pm1/agentic-setup/commit/be3a01a0883a57fe34db8077d4ad90beb2a8bb53))

## [1.0.3](https://github.com/arpit-pm1/agentic-setup/compare/v1...v1.0.3) (2026-07-13)


### Bug Fixes

* resolve CI template path by checking both development and production locations ([be96977](https://github.com/arpit-pm1/agentic-setup/commit/be969770856fed857b58b28eeeb63e6072df7abe))

## [1.0.2](https://github.com/arpit-pm1/agentic-setup/compare/v1...v1.0.2) (2026-07-06)


### Bug Fixes

* handle absolute paths in backup and restore operations by calculating relative path from cwd ([1e0adfc](https://github.com/arpit-pm1/agentic-setup/commit/1e0adfcb96a052573f4a8eb3019f08284a11f558))


### Features

* implement modular skill system with multi-agent support and integrate automated test/scoring patterns ([14d3efa](https://github.com/arpit-pm1/agentic-setup/commit/14d3efa39bb9b08bab409c227ed03cd52089f0c7))

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
