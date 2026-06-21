---
applyTo: "tests/**/*.ts"
---
# Testing Patterns
- Vitest config in `vitest.config.ts`, setup in `tests/setup.ts`.
- LLM calls globally mocked in `tests/setup.ts` — never call real providers.
- Use `vi.mock()` for `fs` and `child_process` mocks.