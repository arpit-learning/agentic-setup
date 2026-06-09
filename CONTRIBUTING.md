# Contributing to agentic-setup

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone git@github.com:arpit-pm1/agentic-setup.git
cd agentic-setup
npm install
npm run dev      # Watch mode
npm run test     # Run tests
npm run build    # Compile
```

## Development

- **Build**: `npm run build` (tsup → `dist/`)
- **Watch**: `npm run dev`
- **Test**: `npm run test` (Vitest)
- **Type check**: `npx tsc --noEmit`
- **Single test**: `npx vitest run src/scoring/__tests__/accuracy.test.ts`

### Project structure

| Directory | Purpose |
|-----------|---------|
| `src/commands/` | CLI commands (init, score, setup, etc.) |
| `src/ai/` | LLM-powered generation, refinement, detection |
| `src/llm/` | Multi-provider LLM layer (Anthropic, Vertex, OpenAI, Claude CLI, Cursor) |
| `src/fingerprint/` | Project analysis (languages, deps, file tree) |
| `src/scoring/` | Deterministic config quality scoring |
| `src/writers/` | File writers for Claude/Cursor configs |
| `src/scanner/` | Local state detection |

### Key conventions

- ES module imports require `.js` extension (even for `.ts` source)
- Prefer `unknown` over `any`
- Tests live in `__tests__/` directories next to their source
- Global LLM mocks are in `src/test/setup.ts`

## Releases

Publishing is **manual** via GitHub Actions (**Actions → Publish Package → Run workflow**).

### Workflow inputs

| Input | Options | Purpose |
|-------|---------|---------|
| `release_type` | `release`, `alpha`, `beta`, `rc` | npm dist-tag and version shape |
| `version_bump` | `patch`, `minor`, `major` | Semver bump when `release_type = release` |
| `build_type` | `prod`, `beta`, `stage` | `prod` = lint + typecheck + test + build; `beta` = test + build; `stage` = build + smoke only |
| `branch` | default `main` | Branch to release from |

### npm channels

| release_type | npm tag | Version example | Install |
|--------------|---------|-----------------|---------|
| `release` | `latest` | `1.2.0` | `npm i agentic-setup` |
| `alpha` | `alpha` | `1.2.1-alpha.0` | `npm i agentic-setup@alpha` |
| `beta` | `beta` | `1.2.1-beta.0` | `npm i agentic-setup@beta` |
| `rc` | `rc` | `1.2.1-rc.0` | `npm i agentic-setup@rc` |

### Required secrets

- `NPM_TOKEN` — publish to [npmjs.com](https://www.npmjs.com/package/agentic-setup)
- `RELEASE_TOKEN` — push version commits and tags back to the repo

### Testing a pre-release

```bash
npx agentic-setup@alpha score
```

## Branch model

| Branch | Purpose |
|--------|---------|
| `main` | Stable integration; release source for `latest` npm tag |
| `beta` | Pre-release integration and testing |
| `staging` | Active development / feature integration |

Open PRs into `staging`, `beta`, or `main` depending on your change. CI runs on all three.

## CI / PR checks

Every pull request triggers parallel GitHub Actions jobs:

| Check | What it runs |
|-------|----------------|
| `lint` | ESLint + Prettier format check |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest (Ubuntu + Windows, Node 20 + 22) |
| `build` | `tsup` build + CLI smoke test |
| `security-audit` | `npm audit --audit-level=high` |
| `score` | Dogfooded `agentic-setup score --compare` with PR comment |
| `analyze` (CodeQL) | Static security analysis |

Run the same gate locally before pushing:

```bash
npm run ci:check
npm audit --audit-level=high
```

### Branch protection (repo settings)

After workflows are enabled on GitHub, configure **Settings → Branches** for `main` (and optionally `beta`):

**Required status checks:** `lint`, `typecheck`, `test`, `build`, `security-audit`, `score`, `analyze` (CodeQL — enable after first run)

**Recommended:** require 1 PR review, dismiss stale approvals on new commits, enable Dependabot security updates.

## Pull requests

1. Fork the repo and create a branch from `main` (or `staging` for in-flight work)
2. Make your changes
3. Add tests for new functionality
4. Run `npm run ci:check` locally
5. Use [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `chore:`
6. For risky changes, publish an `alpha` / `beta` / `rc` build from the **Publish Package** workflow before cutting a stable `release`

## Reporting issues

Open an issue with:
- What you expected vs what happened
- Steps to reproduce
- Your environment (Node version, OS, provider used)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
