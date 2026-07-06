import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { normalize } from 'path';
import {
  extractEnvVars,
  extractDockerServices,
  extractRuntimeVersion,
  extractConfigFiles,
  extractRunCommands,
  collectProjectContext,
  detectStackProgrammatically,
} from '../../src/fingerprint/project-context.js';

vi.mock('fs');

const mockFs = vi.mocked(fs);

function setupFs(files: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    normalized[normalize(k)] = v;
  }

  mockFs.existsSync.mockImplementation((path: fs.PathLike) => {
    return normalized[String(path)] !== undefined;
  });

  mockFs.readFileSync.mockImplementation(((path: fs.PathLike) => {
    const content = normalized[String(path)];
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }) as any);
}

describe('extractEnvVars', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('extracts unique environment variable names from env files', () => {
    setupFs({
      [normalize('/p/.env.example')]: 'PORT=3000\nDATABASE_URL=postgres://localhost\n# Comment\n  INVALID = space',
      [normalize('/p/.env.template')]: 'PORT=3000\nAPI_KEY=secret_key',
    });

    const envVars = extractEnvVars('/p');
    expect(envVars).toEqual(['API_KEY', 'DATABASE_URL', 'PORT']);
  });
});

describe('extractDockerServices', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('extracts known service names from docker-compose files', () => {
    setupFs({
      [normalize('/p/docker-compose.yml')]: `
services:
  db:
    image: postgres:15-alpine
  cache:
    image: redis:alpine
  worker:
    image: custom-worker
`,
    });

    const services = extractDockerServices('/p');
    expect(services).toEqual(['postgres', 'redis']);
  });
});

describe('extractRuntimeVersion', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('detects runtime version from package.json engines', () => {
    setupFs({
      [normalize('/p/package.json')]: JSON.stringify({
        engines: { node: '>=18.0.0' },
      }),
    });
    expect(extractRuntimeVersion('/p')).toBe('node:>=18.0.0');
  });

  it('detects runtime version from .nvmrc', () => {
    setupFs({
      [normalize('/p/.nvmrc')]: '20.10.0\n',
    });
    expect(extractRuntimeVersion('/p')).toBe('node:20.10.0');
  });

  it('detects runtime version from go.mod', () => {
    setupFs({
      [normalize('/p/go.mod')]: 'module test\n\ngo 1.21.3\n',
    });
    expect(extractRuntimeVersion('/p')).toBe('go:1.21.3');
  });

  it('detects runtime version from .python-version', () => {
    setupFs({
      [normalize('/p/.python-version')]: '3.11.4\n',
    });
    expect(extractRuntimeVersion('/p')).toBe('python:3.11.4');
  });
});

describe('extractConfigFiles', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('detects existing configuration files', () => {
    setupFs({
      [normalize('/p/tsconfig.json')]: '{}',
      [normalize('/p/vite.config.ts')]: 'console.log()',
      [normalize('/p/docker-compose.yml')]: '',
    });

    const configs = extractConfigFiles('/p', ['tsconfig.json', 'vite.config.ts']);
    expect(configs).toEqual(['docker-compose.yml', 'tsconfig.json', 'vite.config.ts']);
  });
});

describe('extractRunCommands', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('extracts script commands from package.json and targets from Makefile', () => {
    setupFs({
      [normalize('/p/package.json')]: JSON.stringify({
        scripts: { build: 'tsc', test: 'vitest', dev: 'node dev.js', deploy: 'aws s3 sync' },
      }),
      [normalize('/p/Makefile')]: 'build:\n\techo build\ntest:\n\techo test\n.PHONY: test\n',
    });

    const commands = extractRunCommands('/p');
    expect(commands).toEqual({
      build: 'tsc',
      test: 'vitest',
      dev: 'node dev.js',
      'make:build': 'make build',
      'make:test': 'make test',
    });
  });
});

describe('collectProjectContext', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('collects all context categories together', () => {
    setupFs({
      [normalize('/p/package.json')]: JSON.stringify({
        engines: { node: '>=20.0.0' },
        scripts: { build: 'tsc', test: 'vitest' },
      }),
      [normalize('/p/.env.example')]: 'PORT=3000',
    });

    const context = collectProjectContext('/p', ['package.json', '.env.example']);
    expect(context.envVars).toEqual(['PORT']);
    expect(context.runtimeVersion).toBe('node:>=20.0.0');
    expect(context.runCommands).toEqual({ build: 'tsc', test: 'vitest' });
    expect(context.configFiles).toEqual([]);
  });
});

describe('detectStackProgrammatically', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('detects languages, frameworks, and tools from project structure', () => {
    setupFs({
      [normalize('/p/package.json')]: JSON.stringify({
        dependencies: {
          next: '14.0.0',
          react: '18.2.0',
          express: '4.18.2',
        },
        devDependencies: {
          vitest: '1.0.0',
          eslint: '8.0.0',
          typescript: '5.0.0',
        },
      }),
      [normalize('/p/docker-compose.yml')]: 'image: postgres',
      [normalize('/p/.github/workflows/ci.yml')]: '',
    });

    const stack = detectStackProgrammatically('/p', ['package.json', 'docker-compose.yml', '.github/workflows/ci.yml']);
    expect(stack.languages).toContain('TypeScript');
    expect(stack.languages).toContain('JavaScript');
    expect(stack.frameworks).toContain('Next.js');
    expect(stack.frameworks).toContain('React');
    expect(stack.frameworks).toContain('Express');
    expect(stack.tools).toContain('Vitest');
    expect(stack.tools).toContain('ESLint');
    expect(stack.tools).toContain('Docker');
    expect(stack.tools).toContain('GitHub Actions');
  });

  it('detects python frameworks and tools', () => {
    setupFs({
      [normalize('/p/requirements.txt')]: 'fastapi==0.100.0\nuvicorn==0.22.0',
      [normalize('/p/main.py')]: '',
      [normalize('/p/Dockerfile')]: '',
    });

    const stack = detectStackProgrammatically('/p', ['requirements.txt', 'main.py', 'Dockerfile']);
    expect(stack.languages).toContain('Python');
    expect(stack.frameworks).toContain('FastAPI');
    expect(stack.tools).toContain('Docker');
  });
});
