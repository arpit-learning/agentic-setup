---
name: testing-guide
description: Guides writing, running, and debugging tests in the agentic-setup codebase using Vitest. Use when writing new tests, running test suites, or debugging test failures (e.g., 'run tests', 'write test for command', 'test failing'). Key capabilities include running tests using Vitest and verifying TypeScript compiling with tsc. Do NOT use for package publishing or production code authoring.
---
# Testing Guide

## Critical
- **Test Placement**: All tests MUST live in the `tests/` directory and mirror the `src/` directory layout (e.g., `tests/scoring/accuracy.test.ts` tests `src/scoring/accuracy.ts`).
- **ES Module Imports**: All local imports MUST end with `.js` extension (e.g., `import { score } from '../../src/scoring/index.js'`), even when importing TypeScript files.
- **Mocking**: Global LLM mocks are defined in `tests/setup.ts`. Never make real LLM network calls during tests.
- **No 'any'**: Prefer `unknown` over `any` in test variables and parameters.
- **Verification**: You must always verify that both `vitest` runs cleanly and `npx tsc --noEmit` passes before marking a testing task complete.

## Instructions
1. **Identify Target File and Mirror Layout**
   - Determine the source file you are testing (e.g., `src/commands/init.ts`).
   - Locate or create the corresponding test file: `tests/commands/init.test.ts`.
   - *Validation Gate*: Verify that the path in `tests/` matches the path in `src/` exactly.

2. **Import Dependencies and ESM Extension**
   - Import Vitest helpers: `import { describe, it, expect, vi } from 'vitest';`.
   - Import the source file using a relative path and appending `.js` to the filename.
   - *Validation Gate*: Verify imports end with `.js`. E.g., `import { initCommand } from '../../src/commands/init.js';`.

3. **Write Test Assertions**
   - Structure tests using standard `describe` and `it` blocks.
   - Use mock data instead of real filesystem/network operations where applicable, or use helpers from `tests/utils/` if available.
   - *Validation Gate*: Verify no raw API keys or network requests are executed during this step.

4. **Run Single Test**
   - Execute only the written test file to verify logic.
   - Run command: `npx vitest run tests/path/to/test.test.ts`.
   - *Validation Gate*: Verify the command outputs `1 passed` (or all passed) with no failures.

5. **Run Type Checks**
   - Ensure TypeScript compilation is clean.
   - Run command: `npx tsc --noEmit`.
   - *Validation Gate*: Verify that `tsc` exits with status code 0 (no compile errors).

6. **Run Full Test Suite**
   - Verify changes didn't break other parts of the system.
   - Run command: `pnpm test`.
   - *Validation Gate*: Verify all tests pass.

## Examples
### Example 1: Creating a test for a new utility
User says: "Write a test for the new format utility in src/utils/format.ts"
Actions taken:
1. Created test file: `tests/utils/format.test.ts`
2. Wrote imports with `.js` suffix:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { formatName } from '../../src/utils/format.js';
   ```
3. Wrote test cases:
   ```typescript
   describe('formatName', () => {
     it('should format clean names', () => {
       expect(formatName('hello')).toBe('Hello');
     });
   });
   ```
4. Executed the test: `npx vitest run tests/utils/format.test.ts`
5. Ran type checks: `npx tsc --noEmit`
Result: Test created, verified, and typescript compiles cleanly.

## Common Issues
- **Issue**: `Error: Cannot find module './foo' or its corresponding type declarations.`
  - **Fix**: Check your import statement. You must append `.js` even if the file is `.ts` (e.g., `import { foo } from './foo.js'`).
- **Issue**: Test fails or times out when calling LLM/AI modules.
  - **Fix**: Double check that the test environment is correctly configured to load `tests/setup.ts` which mocks global LLMs, or mock the import manually using `vi.mock('../../src/ai/some-module.js')`.