---
applyTo: "src/writers/**/*.ts"
---
# Writer Patterns
- Config writers return `string[]` of written paths.
- Backups via `src/writers/backup.ts`.
- Manifest writes managed via `src/writers/manifest.ts`.