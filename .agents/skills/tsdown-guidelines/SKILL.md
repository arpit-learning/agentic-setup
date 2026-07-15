---
name: tsdown-guidelines
description: Provides build guidelines, configuration setups, and best practices for tsdown. Use this skill when modifying build processes, adding new entry points, or debugging build compilation errors in package.json or tsdown configurations. Key capabilities include configuring tsdown, validating ESM imports, and resolving build failures. Do NOT use for general Vitest test writing or scanner state detection.
---
# tsdown-guidelines

## Critical

1. **ES Module (ESM) Extensions**: All imports of local files MUST use the `.js` file extension (e.g., `import { config } from './config.js';` instead of `./config`), even though the source files are `.ts`. tsdown relies on these explicit extensions to compile ESM outputs correctly.
2. **Type Checking Pre-requisite**: tsdown does not perform strict type checking during compilation. You MUST run `npx tsc --noEmit` to verify type safety before running or deploying a build.
3. **No `any` Types**: Avoid using the `any` keyword. Use `unknown` or specify explicit types. If `any` is encountered, refactor it to `unknown` and add safe type assertions.

## Instructions

1. **Verify Import Extensions**
   - Examine all changed or new files in `src/` to ensure local imports end with `.js`.
   - *Validation Gate*: Run a search or review import statements in the file. Ensure no imports of local modules are missing the `.js` extension.
   
2. **Run TypeScript Type Verification**
   - Run type checking using the TypeScript compiler.
   - *Validation Gate*: Run `npx tsc --noEmit`. Verify that the command exits with code 0. Resolve any type mismatch errors before proceeding. (This step uses the code verified in Step 1).

3. **Execute the tsdown Build**
   - Compile the TypeScript source code using tsdown.
   - *Validation Gate*: Run `pnpm run build`. Verify that the compilation completes without errors and the `dist/` directory is updated with the compiled files. (This step depends on Step 2).

4. **Run Unit and Integration Tests**
   - Execute the test suite using Vitest to ensure no regression was introduced.
   - *Validation Gate*: Run `pnpm run test` or `npx vitest run <changed-test-file>` and ensure all tests pass. (This step depends on Step 3).

## Examples

### Example 1: Adding a new module and updating imports
* **User says**: "Add a new AI provider helper in src/ai/gemini.ts and import it in src/ai/index.ts"
* **Actions taken**:
  1. Created `src/ai/gemini.ts` containing the helper logic.
  2. Modified `src/ai/index.ts` to import the helper using:
     ```typescript
     import { GeminiProvider } from './gemini.js';
     ```
  3. Ran `npx tsc --noEmit` to verify type safety.
  4. Ran `pnpm run build` to compile the changes using tsdown.
  5. Ran `pnpm run test` to verify no existing tests were broken.
* **Result**: Project builds successfully and outputs compiled JS files under `dist/` with correct ESM import paths.

## Common Issues

* **Issue**: `Error: Cannot find module './xyz' or its corresponding type declarations.`
  - **Fix**:
    1. Check the import statement in the file.
    2. Change the import to specify the `.js` extension (e.g. `import { xyz } from './xyz.js'`).
    3. Run `npx tsc --noEmit` to verify it resolves correctly.

* **Issue**: Build succeeds but running the output results in `ERR_MODULE_NOT_FOUND`.
  - **Fix**:
    1. Check `dist/` outputs to see if target imports were compiled without `.js`.
    2. Verify the source file has `.js` on the import statement.
    3. Re-run `pnpm run build` to regenerate the output.