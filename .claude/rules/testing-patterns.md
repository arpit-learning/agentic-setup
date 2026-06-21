---
paths:
  - tests/**
---
# Testing Patterns
- Config in `vitest.config.ts`, setup in `tests/setup.ts`.
- LLM calls globally mocked in `tests/setup.ts` — never mock real providers.
- Use `vi.mock()` for `fs` and `child_process` mocks.