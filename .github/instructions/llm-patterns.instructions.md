---
applyTo: "src/llm/**,tests/llm/**"
---

# LLM Provider Patterns

- Providers implement `LLMProvider` from `src/llm/types.ts`: `call()`, `stream()`, optional `listModels()`
- Factory: `getProvider()` / `llmCall()` in `src/llm/index.ts` · Config: `loadConfig()` in `src/llm/config.ts` → `~/.agentic-setup/config.json`
- Seat-based (`isSeatBased()`): `cursor`, `claude-cli`, `opencode` — skip full `validateModel()` probe
- Cursor: `CursorAcpProvider` in `src/llm/cursor-acp.ts` · Claude CLI: `src/llm/claude-cli.ts` · OpenCode: `src/llm/opencode.ts`
- JSON parsing: `extractJson()`, `parseJsonResponse()` in `src/llm/utils.ts`
- Model recovery: `src/llm/model-recovery.ts` · Seat errors: `src/llm/seat-based-errors.ts`
- Usage tracking: `trackUsage()` from `src/llm/usage.ts` · Preflight: `validateLlmSetup()` in `src/llm/preflight.ts`
- Fast model: `getFastModel()` in `src/llm/config.ts` — respects `AGENTIC_SETUP_FAST_MODEL` env var