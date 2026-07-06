---
name: npm-guidelines
description: Guides NPM dependency management, scripts configuration, TSDown build checks, and ESM-compliant development in agentic-setup. Use when adding or updating package dependencies, modifying package.json scripts, troubleshooting compilation/types, or preparing releases. Do NOT use for general LLM prompt editing or editing test mocks directly.
---
# NPM Integration and Workflow Guidelines

## Critical
- **ESM Import Rule**: All local TypeScript/JavaScript imports in `src/` and `tests/` MUST include the explicit `.js` extension (e.g., `import { setup } from './setup.js'`). Failure to do so will cause runtime module resolution errors.
- **Strict Compilation**: Always run type checking (`npx tsc --noEmit`) and the build script (`npm run build`) before finalizing any dependency changes or package configuration edits.
- **No Direct Secrets**: Never add auth tokens, API keys, or private registry credentials to `package.json` or `.npmrc` files directly. Use environment variables via `.env`.

## Instructions

### 1. Adding or Modifying Dependencies
1. Add the package to `package.json` under `dependencies` or `devDependencies` using the appropriate npm command (e.g., `npm install --save-dev <package>`). Avoid editing `package.json` manually to prevent version conflicts.
2. **Validation**: Run `npm install` to update the `package-lock.json` and ensure there are no installation or resolution conflicts.
3. **Dependencies check**: Verify that the new package is listed in `package.json` and matches the lockfile. Ensure no unused dependencies remain.

### 2. Updating Build and Dev Scripts
1. When modifying build scripts, ensure they align with the project standard using `tsdown` for compiling code to `dist/`. The main script should remain `npm run build` which invokes `tsdown`.
2. **Validation**: Run `npm run build` and verify that output files are successfully generated in `dist/` without compilation errors.
3. **Dev Verification**: Run `npm run dev` to ensure watch mode works correctly with the updated setup.

### 3. ESM and Type Resolution Auditing
1. Scan all modified files for relative import statements. Ensure every relative import has the `.js` extension (even if importing a `.ts` file).
2. **Validation**: Run the TypeScript compiler check using `npx tsc --noEmit`.
3. **Dependency check**: If the build succeeds, proceed to Step 4. If type checking fails, verify that `@types/...` is installed under `devDependencies` for the respective package.

### 4. Running Verification Tests
1. Run the entire test suite using `npm run test` or run target tests with `npx vitest run tests/<path-to-test>`. This project uses Vitest.
2. **Validation**: Verify that all tests pass. If telemetry or API calls are used, ensure they are mocked as specified in `tests/setup.ts`.

### 5. Preparing for Releases
1. This project utilizes a manual release flow with `release-it`. Ensure all changes are committed and code quality checks pass.
2. **Validation**: Execute `npx release-it --dry-run` to preview the version bump, tag creation, and changelog generation without performing the actual release.

## Examples

### Example 1: Adding a new utility library
- **User says**: "Add the fast-glob library to devDependencies and make sure imports work."
- **Actions taken**:
  1. Run `npm install --save-dev fast-glob`.
  2. Create a new utility or update an existing import: `import glob from 'fast-glob';`.
  3. Verify type checking by running `npx tsc --noEmit`.
  4. Run `npm run build` to confirm `tsdown` compiles the build.
- **Result**: `fast-glob` is correctly added to `devDependencies`, imports resolve without ESM extension issues, and build passes.

## Common Issues

- **Error**: `Cannot find module './utils' or its corresponding type declarations.`
  - **Fix**: Add the `.js` extension to the relative import path (e.g., change `import { foo } from './utils'` to `import { foo } from './utils.js'`).

- **Error**: `tsc yields typescript errors regarding missing declaration files for a package.`
  - **Fix**:
    1. Check if the library includes built-in types. If not, install `@types/<package-name>` under `devDependencies`.
    2. If no types exist, add a custom declaration file in a global types directory or cast imports where appropriate using `unknown`.

- **Error**: `Vitest fail on network/telemetry requests during tests.`
  - **Fix**: Ensure that calls to `posthog-node`, `openai`, or `@anthropic-ai/sdk` are properly mocked using the setup definitions in `tests/setup.ts` instead of hitting real endpoints.`