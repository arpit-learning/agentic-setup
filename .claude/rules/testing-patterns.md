---
paths:
  - tests/**
---

# Testing Patterns

- Config: `vitest.config.ts` · Setup: `tests/setup.ts` (auto-loaded)
- Run all: `npm run test` · Single: `npx vitest run tests/scoring/accuracy.test.ts`
- LLM calls globally mocked in `tests/setup.ts` — never mock `@anthropic-ai/sdk`, `openai`, `@anthropic-ai/vertex-sdk` in individual tests
- Use `vi.mock()` for `fs`, `child_process` · `vi.mocked()` for type-safe assertions
- Mirror layout: `tests/llm/config.test.ts` tests `src/llm/config.ts`
- Pattern: `describe` → `beforeEach(vi.clearAllMocks)` → `it` with `expect`
- Env vars: save `process.env` in `beforeEach`, restore in `afterEach`
- Coverage: `npm run test:coverage` (v8 provider, thresholds in `vitest.config.ts`)
