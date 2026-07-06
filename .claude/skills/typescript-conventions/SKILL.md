---
name: typescript-conventions
description: Standardizes TypeScript coding patterns, style guidelines, and type-safety rules. Use this skill when writing or modifying TypeScript source files (.ts), configuring types, or creating tests. Key capabilities include verifying ES module relative imports with .js extensions, enforcing unknown over any, and aligning test folder structure. Do NOT use for raw JavaScript files, shell scripts, or workflow configurations.
paths:
  - src/**/*.ts
  - tests/**/*.ts
---
# TypeScript Conventions

## Critical
- **ES Module Imports:** Every import of a local file/module MUST include the `.js` extension in the import path, even though the source file is a `.ts` file. For example: `import { helper } from './utils.js';` instead of `import { helper } from './utils';`.
- **No `any` Types:** Always prefer `unknown` over `any`. Use proper type narrowing or runtime checks (type guards) to safely cast `unknown` values.
- **Test Layout Mirroring:** Test files must always be stored in the `tests/` directory and mirror the exact layout of the `src/` directory. For example, the test for `src/scoring/accuracy.ts` must be placed at `tests/scoring/accuracy.test.ts`.
- **Type Checking Validation:** You must run `npx tsc --noEmit` before concluding any TypeScript changes to ensure zero compiler warnings/errors.

## Instructions
1. **Define/Edit the TypeScript Module**
   - Place the file in the correct subfolder of `src/` (e.g., `src/commands/`, `src/ai/`, `src/scoring/`).
   - Write imports. Third-party packages (e.g. `@anthropic-ai/sdk`, `chalk`, `commander`) should be imported normally. Local relative files MUST use `.js` extensions.
   - *Validation:* Check that all imports starting with `./` or `../` end in `.js`.

2. **Type Declarations & Narrowing**
   - Ensure all function signatures have explicit argument and return types.
   - For uncertain values (like API responses or file parses), type them as `unknown`. Narrow them using constructs like `instanceof Error` or custom type guards.
   - *Validation:* Search the file for `: any` or `as any` and replace with safer type definitions.

3. **Create/Update Vitest Tests**
   - Create a corresponding test file in `tests/` matching the source file path exactly with the `.test.ts` extension.
   - Import testing utilities or use global mocks defined in `tests/setup.ts` if needed.
   - *Validation:* Run the newly created test using `npx vitest run tests/<path-to-test>.test.ts` and verify it passes.

4. **Build and Validate Changes**
   - Check types using `npx tsc --noEmit`.
   - Run all tests to make sure there are no regressions using `npm run test`.
   - Run `npm run build` to confirm the tsdown compilation output to `dist/` is successful.
   - *Validation:* Confirm that both `npx tsc --noEmit` and `npm run build` complete with zero errors.

## Examples
### Example 1: Creating a scoring utility
User says → 'Create a typescript utility to compute code similarity inside src/scoring/similarity.ts with tests'
Actions taken →
1. Create the source file `src/scoring/similarity.ts`:
```typescript
import { calculateDiff } from '../utils/diff-helper.js'; // Note the .js extension

export interface SimilarityResult {
  score: number;
  matched: boolean;
}

export function computeSimilarity(original: string, updated: string): SimilarityResult {
  const difference = calculateDiff(original, updated);
  const score = Math.max(0, 1 - difference.length / Math.max(original.length, 1));
  return {
    score,
    matched: score > 0.8,
  };
}
```
2. Create the test file `tests/scoring/similarity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeSimilarity } from '../../src/scoring/similarity.js';

describe('computeSimilarity', () => {
  it('should return 1.0 for identical strings', () => {
    const result = computeSimilarity('hello world', 'hello world');
    expect(result.score).toBe(1);
    expect(result.matched).toBe(true);
  });

  it('should return lower score for modified strings', () => {
    const result = computeSimilarity('hello world', 'hello there');
    expect(result.score).toBeLessThan(1);
  });
});
```
3. Run `npx vitest run tests/scoring/similarity.test.ts` and type checking.
Result → File is created, type checks pass, and tests execute successfully.

## Common Issues
- **Error: Cannot find module './xxx.js' or its corresponding type declarations.**
  - *Fix:* Ensure the source file `xxx.ts` actually exists in the same folder. The typescript compiler compiles `.ts` to `.js`, so the import path must use `.js` even if only `xxx.ts` is visible in the source tree.
- **Error: Type 'unknown' is not assignable to type 'string'.**
  - *Fix:* Narrow the type. Add a runtime check: `if (typeof value !== 'string') { throw new Error('Expected string'); }` or use type assertion `value as string` if you have verified the shape beforehand.
- **Error: Vitest environment setup issues or missing mock behavior.**
  - *Fix:* Refer to `tests/setup.ts` to check if mock clients are active or need configuration.