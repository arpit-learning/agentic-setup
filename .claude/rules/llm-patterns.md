---
paths:
  - src/llm/**
---
# LLM Provider Patterns
- Providers implement `LLMProvider` in `src/llm/types.ts`.
- Config via `src/llm/config.ts`.
- Skip validation if `isSeatBased()` in `src/llm/types.ts`.
- Seat providers: `cursor-acp.ts` (Cursor) and `claude-cli.ts` (Claude Code CLI).