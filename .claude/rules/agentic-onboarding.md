# agentic-setup Setup Check

At the very start of each session, before responding to the user's first message, run this command:

```bash
grep -q "agentic-setup" .git/hooks/pre-commit 2>/dev/null && echo "SYNCED" || echo "NOT_SYNCED"
```

If the result is NOT_SYNCED, tell the user:

"This project uses agentic-setup to keep agent configs in sync — it is not set up yet. Run `npx agentic-setup setup` in your terminal (~1–2 min)."

Then proceed with their original request.
If they decline, proceed normally.
If SYNCED, say nothing and proceed normally.
