---
name: javascript-conventions
description: Establishes JavaScript and TypeScript coding patterns, style guidelines, and type-safety rules for agentic-setup. Use this skill when writing or editing TypeScript/JavaScript files in the src/ or tests/ directories. Do NOT use for editing shell scripts, GitHub Actions workflows, or markdown documentation files.
paths:
  - src/**/*.ts
  - src/**/*.js
  - tests/**/*.ts
  - tests/**/*.js
---
# JavaScript and TypeScript Conventions

## Critical
- **ES Module Extension Rule**: All relative imports in TypeScript and JavaScript files MUST include the `.js` extension (e.g., `import { helper } from './utils.js'` instead of `import { helper } from './utils'`). Never omit it, even for `.ts` files.
- **Type Safety**: Avoid using the `any` type under all circumstances. Use `unknown` or specify concrete interfaces/types.
- **Test Placement**: All new tests must be placed in the `tests/` directory mirroring the `src/` directory structure (e.g., source file `src/scoring/checks/lint.ts` maps to `tests/scoring/checks/lint.test.ts`).

## Instructions
1. **Imports and File Setup**:
   - Begin by writing imports. Relative paths must use the `.js` extension.
   - Boilerplate:
     ```typescript
     import { Command } from 'commander';
     import chalk from 'chalk';
     import { someHelper } from '../utils/helper.js';
     ```
   - *Validation Gate*: Run `npx tsc --noEmit` to verify TypeScript compile checks pass. Ensure no compilation errors regarding missing `.js` files occur.

2. **Error Handling and Type Constraints**:
   - When catching exceptions, type the error parameter as `unknown` or `Error`. Do not cast or type it as `any`.
   - Ensure all function signatures specify explicit types for parameters and return values.
   - *Dependency*: This step applies to code implemented in Step 1.
   - *Validation Gate*: Verify that eslint rules do not flag `any` usage by running type checking: `npx tsc --noEmit`.

3. **Writing Command Line Interactions**:
   - When writing CLI prompts or command definitions in `src/commands/`, use packages in the following priority: `commander` for command setup, `@inquirer/confirm` or `@inquirer/select` for prompt interactions, and `chalk` for color output.
   - Boilerplate:
     ```typescript
     import { Command } from 'commander';
     export const myCommand = new Command('my-command')
       .description('Runs my custom command')
       .action(async () => {
         // logic
       });
     ```
   - *Validation Gate*: Build the CLI codebase using `npm run build` (which compiles from `src/` to `dist/` using tsdown) to confirm error-free compilation of command handlers.

4. **Writing Tests**:
   - Test files must use the `vitest` framework and mirror the `src/` directory layout. Load global mocks if testing LLM integrations by referencing patterns in `tests/setup.ts`.
   - Boilerplate:
     ```typescript
     import { describe, it, expect, vi } from 'vitest';
     import { myFunction } from '../../src/utils/myFunction.js';

     describe('myFunction', () => {
       it('should process correctly', () => {
         expect(myFunction()).toBe(true);
       });
     });
     ```
   - *Dependency*: Uses the implementation logic defined in Steps 1 and 2.
   - *Validation Gate*: Run the single test file using `npx vitest run tests/path/to/myTest.test.ts` to ensure it passes.

## Examples
### Example 1: Creating a new utility function and its corresponding test
**User says**:
"Add a utility function under `src/utils/format.ts` to format scoring details, and write a test for it."

**Actions taken**:
1. Created `src/utils/format.ts` using `.js` extension for imports and typed parameters explicitly:
   ```typescript
   import chalk from 'chalk';

   export function formatScore(score: number, details: unknown): string {
     if (score > 80) {
       return chalk.green(`Score: ${score}%`);
     }
     return chalk.red(`Score: ${score}%`);
   }
   ```
2. Created corresponding test at `tests/utils/format.test.ts`:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { formatScore } from '../../src/utils/format.js';

   describe('formatScore', () => {
     it('formats high score as green', () => {
       const result = formatScore(90, {});
       expect(result).toContain('90%');
     });
   });
   ```
3. Verified compilation and test suite by running:
   ```bash
   npx tsc --noEmit
   npx vitest run tests/utils/format.test.ts
   ```

**Result**:
Utility file created, code uses correct `.js` extensions, type checks pass, and tests execute and pass successfully.

## Common Issues
- **Error**: `Cannot find module './helper' or its corresponding type declarations.`
  - *Fix*: Append `.js` to the import statement: `import { helper } from './helper.js'`.
- **Error**: `Unexpected any. Specify a more specific type.`
  - *Fix*: Replace `any` with `unknown` or create an interface/type definition matching the expected structure.
- **Error**: `Vitest environment mismatch or missing mock.`
  - *Fix*: Check if the test relies on global setup. Verify imports are from `vitest` (not `jest`) and that the test is inside the `tests/` folder mirroring the source code.