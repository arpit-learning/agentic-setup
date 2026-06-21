---
applyTo: "src/llm/**/*.ts"
---
# LLM Provider Patterns
- Providers implement `LLMProvider` in `src/llm/types.ts`.
- Config: env vars → `~/.agentic-setup/config.json` via `src/llm/config.ts`.
- Skip validation if `isSeatBased()` in `src/llm/types.ts`.