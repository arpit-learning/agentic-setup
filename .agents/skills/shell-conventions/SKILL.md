---
name: shell-conventions
description: Guides writing and updating bash scripts, CLI wrappers, and Node.js-based helper scripts. Use this when modifying scripts in the scripts/ folder, writing release utilities, or executing command-line processes. Do NOT use for standard Commander CLI commands inside src/commands/ or test files.
---
# Shell Conventions and Coding Guidelines

## Critical
- **Portability and Strict Mode**: All bash scripts must use `#!/usr/bin/env bash` as their shebang (never `#!/bin/bash` or `#!/bin/sh`) and immediately enable strict mode with `set -euo pipefail`.
- **TypeScript ESM Imports**: Any TypeScript scripts executed in the scripts context (such as tsdown compiled files) must use ESM imports with explicit `.js` extensions (e.g. `import { x } from './x.js';`).
- **No Unsafe Evaluations**: Avoid using `eval` or executing raw string interpolations in bash or Node's `child_process.exec`. Use safe argument arrays or library execution helpers like `unrun` where appropriate.

## Instructions
1. **Set Up the Script Environment**:
   - Create the target shell script in the `scripts/` directory.
   - Add the strict mode header:
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail
     ```
   - Verify that the script has execute permissions (`chmod +x scripts/filename.sh`).
2. **Resolve Paths Relativistically**:
   - Determine the script directory relative to the project root to ensure robustness regardless of execution directory:
     ```bash
     SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
     PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
     ```
   - Verify that all relative paths used in commands (e.g., `pnpm run`, `vitest`) are correctly absolute or relative to `PROJECT_ROOT`.
3. **Handle Arguments and Flags Safely**:
   - Use standard parameter expansion for default values to prevent "unbound variable" errors under `set -u`:
     ```bash
     ENV_TARGET="${1:-dev}"
     ```
   - Verify behavior by executing the script with and without arguments.
4. **Implement Clean Up Traps**:
   - Use shell `trap` definitions to clean up temporary files or background processes on exit:
     ```bash
     TMP_DIR=$(mktemp -d)
     cleanup() {
       rm -rf "$TMP_DIR"
     }
     trap cleanup EXIT
     ```
   - Verify cleanup by sending a SIGINT (Ctrl+C) or causing a deliberate command failure, ensuring the cleanup routine runs.

## Examples
### Example 1: Creating a test wrapper script
*User says*: "I want a script to run specific Vitest suites with coverage"
*Actions taken*:
1. Create `scripts/run-coverage.sh` with the following contents:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
   
   cd "$PROJECT_ROOT"
   
   SUITE="${1:-scoring}"
   echo "Running Vitest coverage for suite: $SUITE"
   npx vitest run --coverage "tests/$SUITE"
   ```
2. Run `chmod +x scripts/run-coverage.sh`.
3. Verify execution by running `./scripts/run-coverage.sh scoring`.
*Result*: An executable, portable shell wrapper that follows strict execution principles.

## Common Issues
- **Error: "...: unbound variable"**:
  - Fix: You are accessing a parameter or environment variable that is not set. Provide a fallback default value using `${VAR:-default}` or check if it is set first.
- **Error: "No such file or directory" when referencing paths**:
  - Fix: Ensure you are changing directory to the project root or utilizing an absolute script directory calculation (e.g. `cd "$(dirname "${BASH_SOURCE[0]}")"`).
- **Error: ESM Module resolution failure in TS script runner**:
  - Fix: Check imports in scripts. In TypeScript scripts running under node, imports must contain explicit `.js` extensions, even when importing a `.ts` file.