import fs from 'fs';
import path from 'path';
import type { Fingerprint } from '../fingerprint/index.js';

export interface RunMdContent {
  startup_command: string;
  health_endpoint: string;
  base_url: string;
  test_command: string;
  auth_notes: string;
}

function readPackageScripts(repoRoot: string): Record<string, string> | null {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? null;
  } catch {
    return null;
  }
}

export function detectRunMd(repoRoot: string, fingerprint: Fingerprint): RunMdContent {
  const scripts = readPackageScripts(repoRoot);
  const pkgManager = fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : fs.existsSync(path.join(repoRoot, 'yarn.lock'))
      ? 'yarn'
      : fs.existsSync(path.join(repoRoot, 'bun.lockb'))
        ? 'bun'
        : 'npm';

  let startup = `${pkgManager} run dev`;
  let test = `${pkgManager} test`;
  let baseUrl = 'http://localhost:3000';
  let health = '/health';

  if (scripts) {
    startup = scripts.dev
      ? `${pkgManager} run dev`
      : scripts.start
        ? `${pkgManager} run start`
        : scripts.serve
          ? `${pkgManager} run serve`
          : startup;
    test = scripts.test ? `${pkgManager} test` : test;
  } else if (fs.existsSync(path.join(repoRoot, 'Makefile'))) {
    startup = 'make run';
    test = 'make test';
  } else if (fs.existsSync(path.join(repoRoot, 'gradlew'))) {
    startup = './gradlew bootRun';
    test = './gradlew test';
    baseUrl = 'http://localhost:8080';
    health = '/actuator/health';
  } else if (fs.existsSync(path.join(repoRoot, 'pyproject.toml'))) {
    startup = 'uvicorn main:app --reload';
    test = 'pytest';
    baseUrl = 'http://localhost:8000';
    health = '/health';
  } else if (fingerprint.languages.some((l) => l.toLowerCase() === 'go')) {
    startup = 'go run .';
    test = 'go test ./...';
    baseUrl = 'http://localhost:8080';
  }

  if (fs.existsSync(path.join(repoRoot, 'docker-compose.yml'))) {
    startup = 'docker compose up';
  }

  return {
    startup_command: startup,
    health_endpoint: health,
    base_url: baseUrl,
    test_command: test,
    auth_notes: 'Set required API keys in .env (never commit secrets).',
  };
}

export function formatRunMd(content: RunMdContent): string {
  return `# run.md

Local development and verification for agents and automation.

## Startup

\`\`\`bash
${content.startup_command}
\`\`\`

## Health check

- **base_url**: \`${content.base_url}\`
- **health_endpoint**: \`${content.health_endpoint}\`

\`\`\`bash
curl -sf "${content.base_url}${content.health_endpoint}" || echo "service not ready"
\`\`\`

## Tests

\`\`\`bash
${content.test_command}
\`\`\`

## Auth

${content.auth_notes}
`;
}

export function writeRunMd(
  repoRoot: string,
  fingerprint: Fingerprint,
  options: { dryRun?: boolean; force?: boolean } = {},
): { written: boolean; path: string } {
  const out = path.join(repoRoot, 'run.md');
  if (fs.existsSync(out) && !options.force) {
    return { written: false, path: out };
  }
  const content = formatRunMd(detectRunMd(repoRoot, fingerprint));
  if (!options.dryRun) {
    fs.writeFileSync(out, content);
  }
  return { written: true, path: out };
}
