---
name: prettier-guidelines
description: Prettier integration guidelines, configuration setups, and formatting best practices for TypeScript/JavaScript codebases. Use this when configuring formatting rules, formatting the workspace, or setting up check scripts. Do NOT use for ESLint rules or Vitest configurations.
---
# Prettier Guidelines

## Critical
- Always run formatting checks before commits or PR builds.
- Ensure Prettier is run with `prettier --check` in the CI/CD environment or pre-commit hooks to avoid formatting regressions.
- Prettier must be configured to work seamlessly with TypeScript ESLint configurations without conflicting rules (use `eslint-config-prettier` if integrating with ESLint).
- All TypeScript imports must retain the `.js` extension rule in this project even after formatting.

## Instructions
1. **Define Prettier Configuration (`.prettierrc`)**:
   Create or modify the `.prettierrc` file at the project root with the following options:
   - `semi`: true
   - `singleQuote`: true
   - `trailingComma`: 'all'
   - `printWidth`: 100
   - `tabWidth`: 2
   - `useTabs`: false
   - `endOfLine`: 'lf'
   *Validation gate*: Verify that `.prettierrc` exists and contains valid JSON matching these formatting guidelines.

2. **Define Ignore List (`.prettierignore`)**:
   Create a `.prettierignore` file in the root directory to skip generated files and build directories:
   ```
   dist/
   node_modules/
   coverage/
   .gemini/
   .vscode/
   ```
   *Validation gate*: Verify that `dist/` and `node_modules/` directories are successfully ignored when running Prettier checks.

3. **Add Format Scripts to `package.json`**:
   Add formatting scripts to `package.json` to enable easy local and automated checks:
   - `"format": "prettier --write 'src/**/*.{ts,js,json,md}' 'tests/**/*.{ts,js,json,md}'"`
   - `"format:check": "prettier --check 'src/**/*.{ts,js,json,md}' 'tests/**/*.{ts,js,json,md}'"`
   *Validation gate*: Run `npm run format:check` to ensure Prettier runs successfully and reports status. This step uses the config from Step 1.

4. **Verify TypeScript Import Extensions compatibility**:
   Ensure that formatting does not alter or strip the `.js` extension in TypeScript imports (e.g., `import { foo } from './foo.js';`).
   *Validation gate*: Run `npx tsc --noEmit` after formatting to ensure TypeScript compilation still passes.

## Examples
### Example 1: Add Prettier configuration and scripts to the project
**User says**: Setup Prettier configuration and add scripts for formatting code.
**Actions taken**:
1. Created `.prettierrc` in the root folder with standard configurations.
2. Created `.prettierignore` to skip build and cache directories.
3. Updated `package.json` dependencies to include `prettier`.
4. Updated `package.json` `"scripts"` block with `format` and `format:check` commands.
5. Executed `npm run format` to format the workspace files.
**Result**:
- Files formatted successfully.
- Code styling checked and verified.

## Common Issues
- **If you see "Error: Cannot find module 'prettier'":**
  1. Install Prettier as a devDependency: `npm install --save-dev prettier`
  2. Verify it is listed in `package.json` under `devDependencies`.
- **If you see ESLint and Prettier rules conflicting (e.g., conflicting quote marks or semi-colons):**
  1. Install `eslint-config-prettier`: `npm install --save-dev eslint-config-prettier`
  2. Extend ESLint configuration in `.eslintrc.json` or `.eslintrc.js` with `"prettier"` as the last element in the `"extends"` array.
- **If files in `dist/` or `node_modules/` are being modified by Prettier:**
  1. Verify `.prettierignore` is present in the root directory.
  2. Confirm `dist/` and `node_modules/` are explicitly listed in `.prettierignore`.