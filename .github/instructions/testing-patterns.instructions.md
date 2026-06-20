---
applyTo: "tests/**"
---

# Testing Patterns

- Config: `vitest.config.ts` · Setup: `tests/setup.ts` (auto-loaded, global LLM mocks)
- Run all: `npm run test` · Coverage: `npm run test:coverage` (v8 thresholds in `vitest.config.ts`)
- Single file: `npx vitest run tests/scoring/accuracy.test.ts`
- Never mock `@anthropic-ai/sdk`, `openai`, `@anthropic-ai/vertex-sdk` per-test — mocked globally in `tests/setup.ts`
- Use `vi.mock()` for `fs`, `child_process` · `vi.mocked()` for typed assertions
- Mirror layout: `tests/writers/github-copilot/index.test.ts` tests `src/writers/github-copilot/index.ts`
- Pattern: `describe` → `beforeEach(vi.clearAllMocks)` → `it` with `expect`
- Env vars: snapshot in `beforeEach`, restore in `afterEach`