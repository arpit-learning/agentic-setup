---
name: github-actions-guidelines
description: Guides the setup, maintenance, and debugging of GitHub Actions workflows for building, testing, and publishing packages. Use when editing or creating workflows in .github/workflows/. Do NOT use for local scripting or non-CI automation.
paths:
  - .github/workflows/*.yml
  - .github/workflows/*.yaml
---
# GitHub Actions Guidelines

## Critical
- **Workflows Location**: All workflow definitions MUST be placed in `.github/workflows/` and use the `.yml` or `.yaml` extension.
- **Strict Two-Step Release Flow**: Never configure automatic publishing on every push to main. Publishing MUST be a manual action via `workflow_dispatch` with inputs for `release_type` (`release`, `alpha`, `beta`, `rc`) and `build_type` (`prod`, `beta`, `stage`) as specified in [CONTRIBUTING.md](file:///Users/arpit.malik/.gemini/antigravity-cli/scratch/CONTRIBUTING.md).
- **Build Quality Gates**: For `prod` builds, you MUST run linting, type-checking (`npx tsc --noEmit`), testing (`npm run test`), and building (`npm run build`).
- **Secrets Management**: Never hardcode API keys, npm tokens, or credentials. Use `${{ secrets.GITHUB_TOKEN }}` or custom GitHub Secrets (e.g., `${{ secrets.NPM_TOKEN }}`).

## Instructions
1. **Define the Workflow Trigger**:
   - Set appropriate triggers (e.g., `pull_request` on `main`, or `workflow_dispatch` for publishing).
   - For publishing workflows, configure `workflow_dispatch` with `release_type` (`release`, `alpha`, `beta`, `rc`) and `build_type` (`prod`, `beta`, `stage`) inputs.
   - *Validation Gate*: Verify inputs match the release configuration options specified in the project documentation.

2. **Configure Environment & Runner**:
   - Set `runs-on: ubuntu-latest`.
   - Use `actions/checkout@v4` to pull repository code.
   - Use `actions/setup-node@v4` with `node-version: 20` and set `cache: 'npm'` to optimize dependency installation.
   - *Validation Gate*: Use `npm ci` rather than `npm install` to guarantee reproducible CI environment builds.

3. **Implement Quality and Build Checks**:
   - Execute linting, type-checking, and tests.
   - Run `npx tsc --noEmit` to verify type safety.
   - Run `npm test` or `npm run test` to run Vitest tests.
   - *Validation Gate*: Ensure that tests run in non-watch/CI mode. Vitest defaults to run mode in CI environments automatically, but check if command flags like `run` are needed.

4. **Add Permissions Block for Releases**:
   - If the action commits tags, creates releases, or publishes to GitHub Packages, grant explicit write permissions to the token:
     ```yaml
     permissions:
       contents: write
       packages: write
     ```
   - *Validation Gate*: Verify that publishing or tag-creation commands run only after all quality checks pass successfully.

## Examples
### Example 1: Add a workflow to run checks on Pull Requests
- **User says**: "Create a PR verification workflow that checks linting, typescript types, and runs tests."
- **Actions taken**:
  1. Created file at `.github/workflows/pr-check.yml`.
  2. Configured triggers on PR to `main`.
  3. Setup Node, cached dependencies, and executed lint, type-check, and test steps.
- **Result**:
  ```yaml
  name: PR Check

  on:
    pull_request:
      branches: [ main ]

  jobs:
    check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: 'npm'
        - run: npm ci
        - name: Run Lint & Type Check
          run: |
            npm run lint
            npx tsc --noEmit
        - name: Run Tests
          run: npm test
  ```

## Common Issues
- **Error: `Resource not accessible by integration` when creating tags or releases**:
  - *Fix*: The job is missing write permissions. Add the permissions block to the job or workflow:
    ```yaml
    permissions:
      contents: write
    ```
- **Error: `npm ci can only install packages when package-lock.json is present`**:
  - *Fix*: Ensure `package-lock.json` is not ignored in `.gitignore` and is committed. If the project deliberately doesn't use a lockfile, fallback to `npm install`.
- **Error: CI hangs indefinitely during test execution**:
  - *Fix*: Ensure Vitest is not running in watch mode. Explicitly run `npx vitest run` or verify that the `CI` environment variable is set to `true`.