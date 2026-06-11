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
- **Single test**: `npx vitest run tests/scoring/accuracy.test.ts`

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
| `tests/` | Vitest tests (mirrors `src/` layout) |

### Key conventions

- ES module imports require `.js` extension (even for `.ts` source)
- Prefer `unknown` over `any`
- Tests live in `tests/` (mirrors `src/` layout; e.g. `tests/scoring/accuracy.test.ts`)
- Global LLM mocks are in `tests/setup.ts`

## Releases

Publishing is **manual** via GitHub Actions (**Actions → Publish Package → Run workflow**).

### Workflow inputs

| Input | Options | Purpose |
|-------|---------|---------|
| `release_type` | `release`, `alpha`, `beta`, `rc` | npm dist-tag and version shape |
| `version_bump` | `patch`, `minor`, `major` | Semver bump when `release_type = release` |
| `build_type` | `prod`, `beta`, `stage` | `prod` = lint + typecheck + test + build; `beta` = test + build; `stage` = build + smoke only |
| `branch` | default `main` | Branch to release from |

### Release channels (GitHub Packages)

Each publish bumps semver (patch / minor / major), updates git tags, creates a GitHub Release, and publishes to **GitHub Packages** (`npm.pkg.github.com`).

| release_type | npm dist-tag | Git tag example | Install |
|--------------|--------------|-----------------|---------|
| `release` | `latest` | `v1.2.0` | `npm i @arpit-pm1/agentic-setup` |
| `alpha` | `alpha` | `v1.2.1-alpha.0` | `npm i @arpit-pm1/agentic-setup@alpha` |
| `beta` | `beta` | `v1.2.1-beta.0` | `npm i @arpit-pm1/agentic-setup@beta` |
| `rc` | `rc` | `v1.2.1-rc.0` | `npm i @arpit-pm1/agentic-setup@rc` |

**Consumer auth** — copy [`.npmrc.example`](.npmrc.example) to `~/.npmrc` and set a GitHub PAT with `read:packages` (and repo access if the package is private):

```ini
@arpit-pm1:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Stable releases also append to **`CHANGELOG.md`** via release-it (`@release-it/conventional-changelog`). Prereleases skip changelog generation.

### Required secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `RELEASE_TOKEN` | Yes | GitHub PAT: git push, GitHub Releases, **and** GitHub Packages publish |

**`RELEASE_TOKEN` setup** (Settings → Secrets and variables → Actions → New repository secret):

1. Create a fine-grained PAT (or classic PAT) with **Contents: Read and write** and **Packages: Read and write** on this repo.
2. If `main` / `staging` use branch protection, enable **Bypass branch protections** for the PAT user (or use a classic PAT with `repo` + `write:packages` scope).
3. Add the token as repository secret **`RELEASE_TOKEN`**.

The publish workflow uses `RELEASE_TOKEN` for release-it (commit/tag/push), `npm publish` to GitHub Packages, and `gh release`. No separate `NPM_TOKEN` is required.

### CI release workflows

| Workflow | What it does |
|----------|--------------|
| **Version Bump** | release-it only — semver bump, commit, git tag, push (no npm publish, no GitHub Release) |
| **Publish Package** | validate + build + release-it + publish to GitHub Packages + GitHub Release (+ floating `vMAJOR` on stable) |

Use **Version Bump** when you only need a tagged version on the branch. Use **Publish Package** for a full consumer-facing release.

### Local release dry-run

Version bump, changelog (stable releases), commit, tag, and push are handled by **[release-it](https://github.com/release-it/release-it)** via npm scripts:

```bash
# Stable release (updates CHANGELOG.md)
release-it patch --dry-run
release-it minor --dry-run

# Prerelease (no CHANGELOG — --no-plugins)
release-it patch prerelease --preRelease=alpha --dry-run --no-plugins

# Workflow-equivalent script names
npm run version-bump:patch:alpha
npm run version-bump:minor:release
npm run version:print
npm run ci:check && npm run build
```

In CI, release-it commits and pushes (with CHANGELOG on stable releases). **Publish Package** also publishes to GitHub Packages and creates a GitHub Release. Only **`RELEASE_TOKEN`** is required.

### Testing a pre-release

Configure `.npmrc` per [`.npmrc.example`](.npmrc.example), then:

```bash
npm i @arpit-pm1/agentic-setup@alpha
npx agentic-setup score
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
