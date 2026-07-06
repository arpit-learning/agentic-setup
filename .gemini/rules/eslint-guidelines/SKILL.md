---
name: eslint-guidelines
description: Guides the configuration, rule integration, and type safety audits for ESLint and typescript-eslint. Use when setting up new linter rules, resolving linting violations, or configuring project code standards. Key capabilities include configuring typescript-eslint rules, enforcing ES module import patterns, and verifying compliance. Do NOT use for testing setup or bundler configuration changes.
---
# ESLint Integration & Quality Guidelines

## Critical
- **Never use `any` to bypass type check warnings**; as per project guidelines, prefer `unknown` over `any`. All type assertions must be validated against typescript-eslint standards.
- **Verify ES module import extensions** are explicitly set to `.js` (even for `.ts` files) when configuring or validating rules, to avoid runtime import resolution errors in production builds.
- **Validate changes immediately** using `npx tsc --noEmit` and the local lint scripts prior to finishing any configuration edits.

## Instructions
1. **Verify ESLint Core and TypeScript Parser Setup**
   - Verify that typescript-eslint is present in `package.json` under devDependencies.
   - Validation: Run `npm list typescript-eslint` or check `package.json` directly to confirm the version.
2. **Configure Lint Rules in Project Config**
   - Edit or create the ESLint configuration file (e.g. `eslint.config.js` or `.eslintrc`).
   - Enforce explicit module path resolutions and import suffix rules mapping to the ES module requirements of this project.
   - Validation: Execute `npx eslint --print-config src/commands/init.ts` to ensure the configuration resolves without syntax or plugin errors.
3. **Execute Linting and Codebase Validation**
   - Analyze file compliance by executing the project-specific lint commands.
   - Validation: Run `npx tsc --noEmit` followed by `npx eslint src/ --ext .ts,.js` and verify that the output reports 0 errors and warnings.

## Examples
- **User says**: "Set up linting standards to enforce `unknown` over `any` on TypeScript commands."
- **Actions taken**:
  1. Checked configuration requirements in `package.json` for typescript-eslint dependency.
  2. Updated the ESLint configuration rule set to trigger warnings on implicit `any` use.
  3. Verified parser configuration validity using `npx eslint --print-config src/commands/init.ts`.
  4. Ran `npx tsc --noEmit` and `npx eslint src/` to verify project clean status.
- **Result**: Custom rule enforced; developer errors catch any implicit `any` assignments.

## Common Issues
- **If you see 'Rule typescript-eslint/no-explicit-any not found'**:
  1. Verify the parser and plugin packages are correctly loaded under `plugins`.
  2. Run `npm install typescript-eslint` if the dependency is missing.
- **If you see 'Missing file extension ".js" for ...' lint error**:
  1. Ensure that source code imports explicitly use `.js` extension even if importing a `.ts` file, matching the project's native ES module requirements.