---
name: vitest-patterns
description: Vitest unit and integration testing patterns and conventions. Use this skill when writing new tests, fixing existing tests, or configuring test mocks. Key capabilities include maintaining the test-to-source directory mapping, enforcing ES module .js import extensions, and utilizing setup.ts mocks. Do NOT use this skill for non-testing scripts, GitHub Actions workflows, or source production code changes.
paths:
  - tests/**/*.test.ts
  - tests/**/*.ts
---
# Vitest Testing Patterns

## Critical
- **Mirror Source Structure**: All tests must reside in the `tests/` directory and mirror the exact path structure of the code under test in `src/` (e.g., `src/scoring/checks/complexity.ts` -> `tests/scoring/checks/complexity.test.ts`).
- **ES Module Imports**: All relative import paths must end with a `.js` extension, even when importing from `.ts` files (e.g., `import { scoreConfig } from '../../src/scoring/score.js'`).
- **No Direct Network or LLM Calls**: Tests must not call external APIs. Use mock implementations. Global mocks for LLMs are located in `tests/setup.ts`.
- **Strict Types**: Prefer `unknown` over `any` for variables, parameters, and mock returns in tests.

## Instructions
1. **Determine Test File Path**: Identify the component or command under test (e.g. `src/commands/init.ts`). Create a corresponding test file in `tests/` (e.g. `tests/commands/init.test.ts`).
   - *Validation*: Verify that the folder hierarchy in `tests/` matches `src/` exactly.
2. **Draft Imports**: Import testing primitives (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`) from `vitest`. Import the target code using relative paths ending in `.js`.
   - *Validation*: Confirm all local imports contain the `.js` extension. Example:
     ```typescript
     import { initCommand } from '../../src/commands/init.js';
     ```
3. **Configure Mocks**: If the system under test uses external APIs or SDKs (like `@anthropic-ai/sdk` or `openai`), verify if they are globally mocked in `tests/setup.ts`. For test-specific overrides, use `vi.mock()` at the top of your test file.
   - *Validation*: Run `npx tsc --noEmit` to ensure mock signatures align with the actual interfaces.
4. **Implement Test Cases**: Group related tests inside a `describe` block. Write individual assertions using `it` or `test` blocks. Use helper types or `unknown` for mocked outputs.
   - *Validation*: Assert both successful scenarios and edge/error cases.
5. **Run the Test**: Execute the target test file to verify logic.
   - *Command*: `npx vitest run tests/commands/init.test.ts`
   - *Validation*: Confirm all assertions pass and the command exits with code 0.

## Examples
### Example 1: Creating a test for a scoring check
**User says**:
"Add a unit test for the new config checks utility in src/scoring/checks/env.ts"

**Actions taken**:
1. Identified target: `src/scoring/checks/env.ts`.
2. Created test file at `tests/scoring/checks/env.test.ts`.
3. Wrote test content mirroring the source code structure, importing with `.js` extensions, and using Vitest APIs.
4. Ran the single test file using `npx vitest run tests/scoring/checks/env.test.ts`.

**Result** (`tests/scoring/checks/env.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { checkEnvConfig } from '../../../src/scoring/checks/env.js';

describe('checkEnvConfig', () => {
  it('should score 100 for valid env setup', () => {
    const config = { env: { API_KEY: 'test-key' } };
    const result = checkEnvConfig(config);
    expect(result.score).toBe(100);
  });

  it('should fail with a warning if env is missing keys', () => {
    const config = { env: {} };
    const result = checkEnvConfig(config);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('Missing API_KEY');
  });
});
```

## Common Issues
- **Error**: `Error: Cannot find module './module'` or similar import failures during run.
  - *Fix*: Ensure the import path ends with `.js` (e.g., change `import { foo } from './module'` to `import { foo } from './module.js'`).
- **Error**: Test times out or tries to make real network requests to OpenAI/Anthropic APIs.
  - *Fix*: Mock the SDK imports using `vi.mock('openai')` or ensure `tests/setup.ts` is configured to intercept the call.
- **Error**: TypeScript compilation errors like `Argument of type 'any' is not assignable...` during type checking.
  - *Fix*: Replace `any` with `unknown` and perform type narrowing or cast properly with `as`. Run `npx tsc --noEmit` to verify type checking.