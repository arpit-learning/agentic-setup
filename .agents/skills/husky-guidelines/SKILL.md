---
name: husky-guidelines
description: Integrates and configures Husky Git hooks for automated commit validation. Use when setting up or modifying Git hooks, pre-commit verification scripts, or configuring commit linting. It supports installing Husky, writing hook scripts, managing execution permissions, and debugging hook issues. Do NOT use for editing GitHub workflows, writing unit tests, or configuring NPM releases.
---
# Husky Git Hooks Guidelines

Guidelines and steps to integrate, configure, and maintain Husky Git hooks within the agentic-setup repository to ensure all code is linted, typechecked, and tested before being committed or pushed.

## Critical
1. **Never bypass hooks**: Do not commit with `--no-verify` unless troubleshooting an environmental issue. All hooks must execute successfully.
2. **Hook execution time**: Hooks must run in under 10 seconds. Use selective checks or target specific test suites where possible to keep commit speed fast.
3. **Execution context**: Ensure all hooks use the local project dependencies and execute using `npx` or `npm run` as defined in `package.json`.

## Instructions

1. **Verify Husky Installation**
   - Check if `husky` is already listed under `devDependencies` in `package.json`.
   - If not present, install it using:
     ```bash
     npm install husky --save-dev
     ```
   - Validation Gate: Confirm `"husky"` is listed in `package.json` and `node_modules/husky` exists before proceeding.

2. **Initialize Husky Configuration**
   - For modern Husky (v9+), run the initialization script:
     ```bash
     npx husky init
     ```
   - This command configures the `prepare` script in `package.json` (`"prepare": "husky"`) and creates the `.husky/` directory with a default `pre-commit` script.
   - Validation Gate: Verify that the `.husky/` directory contains a `pre-commit` script file.

3. **Configure Pre-commit Hook**
   - Open `.husky/pre-commit` (typically contains `npm test` by default).
   - Update it to execute the fast checks: typechecking and tests.
     ```bash
     #!/bin/sh
     . "$(dirname "$0")/_/husky.sh"

     # Run typecheck
     npx tsc --noEmit || exit 1

     # Run Vitest in run-once mode
     npm run test -- --run || exit 1
     ```
   - Validation Gate: Ensure `.husky/pre-commit` is executable. On macOS/Linux, run:
     ```bash
     chmod +x .husky/pre-commit
     ```

4. **Verify Hook Execution Locally**
   - Test the pre-commit hook manually by triggering a git commit or running the hook directly:
     ```bash
     ./.husky/pre-commit
     ```
   - Validation Gate: Verify that both typechecking and tests pass, returning an exit code of 0.

## Examples

### Example 1: Integrating Husky for Pre-commit Validation
- **User says**: "Set up git hooks so that typescript files are typechecked and tests are run on every commit."
- **Actions taken**:
  1. Ran `npm install husky --save-dev` to install dependency.
  2. Ran `npx husky init` to set up directory structure.
  3. Modified `.husky/pre-commit` with:
     ```bash
     #!/bin/sh
     . "$(dirname "$0")/_/husky.sh"

     echo "Running pre-commit checks..."
     npx tsc --noEmit && npm test -- --run
     ```
  4. Ran `chmod +x .husky/pre-commit`.
  5. Tested execution with `./.husky/pre-commit`.
- **Result**: Every `git commit` now triggers typescript verification and runs Vitest tests automatically, blocking commits if any verification fails.

## Common Issues

### Hook does not execute on `git commit`
- **Error/Symptom**: Commits succeed even with syntax errors or failing tests, and no Husky output is printed.
- **Fix**:
  1. Verify git is configured to look at `.husky`: `git config core.hooksPath` should return `.husky`.
  2. If not, run:
     ```bash
     git config core.hooksPath .husky
     ```
  3. Ensure the pre-commit hook file is executable:
     ```bash
     chmod +x .husky/pre-commit
     ```

### Prepare script fails in CI/CD or docker
- **Error/Symptom**: `npm install` fails with `husky: command not found` in non-development environments.
- **Fix**:
  - Update the `prepare` script in `package.json` to only run husky if it is installed (ignoring in production):
    ```json
    "prepare": "is-ci || husky"
    ```
  - Or check if NODE_ENV is production before running husky.