---
applyTo: "src/writers/**,tests/writers/**"
---

# Writer Patterns

- Entry: `writeSetup()` in `src/writers/index.ts` · File list: `getFilesToWrite()`
- Copilot: `writeGithubCopilotConfig()` in `src/writers/github-copilot/index.ts` writes `.github/copilot-instructions.md` + `.github/instructions/`
- Managed blocks appended via `appendManagedBlocks()` in `src/writers/pre-commit-block.ts` (pre-commit, learnings, model, sync)
- Staging/review: `stageFiles()` in `src/writers/staging.ts` · Manifest: `src/writers/manifest.ts` · Backups: `src/writers/backup.ts`
- Refresh path: `writeRefreshDocs()` in `src/writers/refresh.ts` consumes `refreshDocs()` from `src/ai/refresh.ts`
- Each platform writer returns `string[]` of written relative paths
- Test coverage: `tests/writers/staging.test.ts` · `tests/writers/github-copilot/index.test.ts`