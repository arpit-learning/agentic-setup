---
paths:
  - src/scoring/**
---
# Scoring Check Patterns
- All checks are deterministic — no LLM/network calls.
- Return `Check[]` from `src/scoring/checks/` files.
- Scoring constants in `src/scoring/constants.ts`.