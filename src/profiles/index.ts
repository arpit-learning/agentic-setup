import type { SetupProfile } from '../lib/project-config.js';
import type { Fingerprint } from '../fingerprint/index.js';

export interface ProfileHints {
  profile: SetupProfile;
  promptFragment: string;
  focusAreas: string[];
}

export function detectProfile(fingerprint: Fingerprint): SetupProfile {
  const langs = new Set(fingerprint.languages.map((l) => l.toLowerCase()));
  const frameworks = new Set(fingerprint.frameworks.map((f) => f.toLowerCase()));
  const tree = fingerprint.fileTree.join('\n').toLowerCase();

  if (
    frameworks.has('react') ||
    frameworks.has('next.js') ||
    frameworks.has('vue') ||
    tree.includes('playwright.config')
  ) {
    return 'ui-feature';
  }
  if (
    langs.has('java') ||
    langs.has('kotlin') ||
    tree.includes('pom.xml') ||
    tree.includes('build.gradle')
  ) {
    return 'java-service';
  }
  if (
    langs.has('python') &&
    (tree.includes('fastapi') || tree.includes('flask') || tree.includes('django'))
  ) {
    return 'python-api';
  }
  if (
    tree.includes('openapi') ||
    tree.includes('swagger') ||
    frameworks.has('express') ||
    frameworks.has('fastify') ||
    frameworks.has('spring')
  ) {
    return 'api-only';
  }
  return 'auto';
}

export function resolveProfile(configured: SetupProfile, fingerprint: Fingerprint): ProfileHints {
  const profile = configured === 'auto' ? detectProfile(fingerprint) : configured;
  const fragments: Record<SetupProfile, string> = {
    auto: 'Generate balanced agent context for this repository.',
    'api-only':
      'Focus on REST/GraphQL endpoints, request/response schemas, auth, error codes, and integration test commands. Minimize UI guidance.',
    'ui-feature':
      'Focus on component structure, routing, state management, design tokens, Playwright/E2E flows, and local dev server startup.',
    'java-service':
      'Focus on Maven/Gradle commands, package layout, Spring profiles, DB migrations, and JVM test/lint commands.',
    'python-api':
      'Focus on virtualenv/poetry setup, FastAPI/Flask routes, pytest commands, ruff/mypy, and env configuration.',
  };
  const focus: Record<SetupProfile, string[]> = {
    auto: ['build', 'test', 'architecture'],
    'api-only': ['endpoints', 'auth', 'schemas', 'integration tests'],
    'ui-feature': ['components', 'routing', 'e2e', 'design system'],
    'java-service': ['gradle/maven', 'packages', 'migrations', 'jvm tests'],
    'python-api': ['venv', 'routes', 'pytest', 'lint'],
  };
  return {
    profile,
    promptFragment: fragments[profile],
    focusAreas: focus[profile],
  };
}
