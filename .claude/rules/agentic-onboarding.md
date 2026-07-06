# Setup Check
At session start, check pre-commit sync:
```bash
grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "SYNCED" || echo "NOT_SYNCED"
```
If NOT_SYNCED, nudge: "Run `npx agentic-setup setup` in your terminal."