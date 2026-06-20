---
applyTo: "src/scoring/**,tests/scoring/**"
---

# Scoring Check Patterns

- All checks deterministic — no LLM, no network, no randomness (`src/scoring/index.ts`)
- Check functions return `Check[]` · Point constants in `src/scoring/constants.ts` — never hardcode
- `filterChecksForTarget()` uses `COPILOT_ONLY_CHECKS`, `CLAUDE_ONLY_CHECKS`, `CURSOR_ONLY_CHECKS` sets in `src/scoring/constants.ts`
- Helpers: `readFileOrNull()`, `collectPrimaryConfigContent()`, `estimateTokens()` in `src/scoring/utils.ts`
- Display: `src/scoring/display.ts` · PR markdown: `src/scoring/markdown.ts` · History: `src/scoring/history.ts`
- Dismissed checks: `src/scoring/dismissed.ts` · `evaluateDismissals()` in `src/commands/init-helpers.ts`
- Test: `npx vitest run tests/scoring/accuracy.test.ts` · Grounding: `tests/scoring/grounding.test.ts`