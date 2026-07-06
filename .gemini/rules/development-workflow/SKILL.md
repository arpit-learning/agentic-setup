---
name: development-workflow
description: Development setup and common workflows. Use when starting development, running the project, or setting up the environment. Key capabilities include repository setup, env configuration, executing tests via Vitest, watch/dev mode, type checking, and production builds. Do NOT use for writing new CLI commands or editing test logic directly.
---
# Development Workflow

## Critical
- Always run `npm run build` after making code changes to verify that compiling via tsdown succeeds.
- Ensure ES module imports specify `.js` extensions (e.g., `import { foo } from "./foo.js"`) even when editing TypeScript source files.
- Prefer `unknown` over `any` across the codebase.
- Ensure all API keys are stored in a `.env` file and never committed to git.

## Instructions
1. **Repository Setup**: Install project dependencies.
   - Action: Run `npm install` in the project root.
   - Validation: Verify that the `node_modules` directory exists and matches dependencies in `package.json`.
2. **Environment Configuration**: Set up local environment variables.
   - Action: Create a `.env` file in the project root.
   - Configuration: Populate required environment variables (e.g., API keys like `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`).
   - Validation: Verify that `.env` is ignored by `.gitignore` to prevent secret leakage.
3. **Local Development (Watch Mode)**: Watch and compile code dynamically.
   - Action: Run `npm run dev` to start compilation in watch mode.
   - Validation: Modify a file under `src/` and verify that `dist/` is automatically updated without errors.
4. **Running Tests**: Run tests with Vitest.
   - Action (Full Suite): Run `npm run test` or `npx vitest` to run all tests.
   - Action (Single Test File): Run `npx vitest run tests/<path_to_test>.test.ts` (e.g., `npx vitest run tests/scoring/accuracy.test.ts`).
   - Validation: Confirm that all test cases execute successfully with 0 errors.
5. **Type Checking**: Perform TypeScript static analysis.
   - Action: Run `npx tsc --noEmit`.
   - Validation: Verify that no compiler errors or warnings are outputted.
6. **Production Build**: Compile production assets.
   - Action: Run `npm run build`.
   - Validation: Confirm that `dist/` contains the compiled files and that compilation succeeded.

## Examples
### Example 1: Developer setting up the environment for the first time
- **User says**: "I just cloned the repo. How do I make sure everything is working?"
- **Actions taken**:
  1. Ran `npm install` to download dependencies.
  2. Created a `.env` file in the root folder with the necessary LLM API keys.
  3. Ran `npx tsc --noEmit` to verify type safety.
  4. Ran `npm run test` to execute all Vitest test suites.
- **Result**: The local setup is complete, all dependencies are installed, and all tests pass successfully.

## Common Issues
- **Error: "Cannot find module './module.js' or its corresponding type declarations"**
  - **Cause**: TypeScript files import each other but are missing the `.js` extension required by the ES module configuration.
  - **Fix**: Append `.js` to the import path (e.g., `import { helper } from './helper.js'`).
- **Error: LLM-related tests fail due to missing keys**
  - **Cause**: Missing `.env` file or incomplete API keys configuration.
  - **Fix**: Check that the `.env` file exists in the root folder and holds correct keys (e.g., `ANTHROPIC_API_KEY`).
- **Error: Type checking failures on strict mode checks**
  - **Cause**: Use of `any` instead of `unknown`, or mismatch in function return types.
  - **Fix**: Trace using the output of `npx tsc --noEmit`, adjust typings accordingly, and re-run build.