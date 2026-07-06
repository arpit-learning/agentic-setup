import fs from 'fs';
import path from 'path';

export interface ProjectContext {
  envVars: string[];
  services: string[];
  buildTool?: string;
  runCommands?: Record<string, string>;
  runtimeVersion?: string;
  configFiles: string[];
}

function readFileOrNull(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

export function extractEnvVars(dir: string): string[] {
  const envFiles = ['.env.example', '.env.template', '.env.sample', '.env.defaults', '.env.dist'];
  const keys = new Set<string>();

  for (const filename of envFiles) {
    const filePath = path.join(dir, filename);
    const content = readFileOrNull(filePath);
    if (content) {
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
        if (match) {
          keys.add(match[1]);
        }
      }
    }
  }

  return Array.from(keys).sort();
}

export function extractDockerServices(dir: string): string[] {
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yaml'];
  const services = new Set<string>();

  const knownKeywords = [
    'postgres',
    'redis',
    'mysql',
    'mariadb',
    'mongodb',
    'rabbitmq',
    'elasticsearch',
    'localstack',
    'dynamodb',
    'kafka',
    'clickhouse',
    'sqlite',
    'neo4j',
    'cassandra',
    'memcached',
  ];

  for (const filename of composeFiles) {
    const filePath = path.join(dir, filename);
    const content = readFileOrNull(filePath);
    if (content) {
      // Find service names by looking for 'image:' definitions
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/\s+image:\s*([a-zA-Z0-9_/:-]+)/);
        if (match) {
          const imageName = match[1].toLowerCase();
          for (const keyword of knownKeywords) {
            if (imageName.includes(keyword)) {
              services.add(keyword);
            }
          }
        }
      }
    }
  }

  return Array.from(services).sort();
}

export function extractRuntimeVersion(dir: string): string | undefined {
  // 1. Node.js
  const pkgContent = readFileOrNull(path.join(dir, 'package.json'));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      if (pkg.engines?.node) {
        return `node:${pkg.engines.node}`;
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  const nvmrc = readFileOrNull(path.join(dir, '.nvmrc'));
  if (nvmrc) {
    const version = nvmrc.trim();
    if (version) return `node:${version}`;
  }

  const nodeVersion = readFileOrNull(path.join(dir, '.node-version'));
  if (nodeVersion) {
    const version = nodeVersion.trim();
    if (version) return `node:${version}`;
  }

  // 2. Go
  const goMod = readFileOrNull(path.join(dir, 'go.mod'));
  if (goMod) {
    const match = goMod.match(/^go\s+([0-9.]+)/m);
    if (match) return `go:${match[1]}`;
  }

  // 3. Python
  const pythonVersion = readFileOrNull(path.join(dir, '.python-version'));
  if (pythonVersion) {
    const version = pythonVersion.trim();
    if (version) return `python:${version}`;
  }

  const runtimeTxt = readFileOrNull(path.join(dir, 'runtime.txt'));
  if (runtimeTxt) {
    const match = runtimeTxt.match(/python-([0-9.]+)/i);
    if (match) return `python:${match[1]}`;
  }

  return undefined;
}

export function extractConfigFiles(dir: string, fileTree: string[]): string[] {
  const targetConfigs = new Set([
    'tsconfig.json',
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.mjs',
    'next.config.js',
    'next.config.ts',
    'next.config.mjs',
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.mjs',
    '.eslintrc.json',
    '.eslintrc.js',
    '.prettierrc',
    'prisma/schema.prisma',
    'webpack.config.js',
    'webpack.config.ts',
    'Makefile',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yaml',
  ]);

  const existing = new Set<string>();

  // Check fileTree first (efficient)
  const treeSet = new Set(fileTree);
  for (const config of targetConfigs) {
    if (treeSet.has(config)) {
      existing.add(config);
    } else if (fs.existsSync(path.join(dir, config))) {
      existing.add(config);
    }
  }

  return Array.from(existing).sort();
}

export function extractRunCommands(dir: string): Record<string, string> {
  const commands: Record<string, string> = {};

  // 1. package.json scripts
  const pkgContent = readFileOrNull(path.join(dir, 'package.json'));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      if (pkg.scripts) {
        const scriptKeys = ['build', 'test', 'lint', 'format', 'start', 'dev'];
        for (const key of scriptKeys) {
          if (pkg.scripts[key]) {
            commands[key] = pkg.scripts[key];
          }
        }
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  // 2. Makefile targets
  const makefile = readFileOrNull(path.join(dir, 'Makefile'));
  if (makefile) {
    const lines = makefile.split('\n');
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+):/);
      if (match && match[1] !== '.PHONY') {
        commands[`make:${match[1]}`] = `make ${match[1]}`;
      }
    }
  }

  return commands;
}

export function collectProjectContext(dir: string, fileTree: string[] = []): ProjectContext {
  return {
    envVars: extractEnvVars(dir),
    services: extractDockerServices(dir),
    runtimeVersion: extractRuntimeVersion(dir),
    configFiles: extractConfigFiles(dir, fileTree),
    runCommands: extractRunCommands(dir),
  };
}

export interface ProgrammaticStack {
  languages: string[];
  frameworks: string[];
  tools: string[];
}

export function detectStackProgrammatically(dir: string, fileTree: string[]): ProgrammaticStack {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const tools = new Set<string>();

  const fileTreeSet = new Set(fileTree);

  // Helper to check fileTree or directory existence
  const hasFile = (filename: string) => {
    if (fileTreeSet.has(filename)) return true;
    try {
      return fs.existsSync(path.join(dir, filename));
    } catch {
      return false;
    }
  };

  // Helper to check for file extensions
  const hasExtension = (ext: string) => {
    for (const f of fileTree) {
      if (f.endsWith(ext)) return true;
    }
    return false;
  };

  // Read package.json deps
  let jsDeps: Record<string, string> = {};
  const pkgContent = readFileOrNull(path.join(dir, 'package.json'));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      jsDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
    } catch {}
  }

  // Read python deps (requirements.txt / pyproject.toml)
  const pyDeps = new Set<string>();
  const reqTxt = readFileOrNull(path.join(dir, 'requirements.txt'));
  if (reqTxt) {
    reqTxt.split('\n').forEach((l) => {
      const name = l
        .trim()
        .split(/[=<>!~[]/)[0]
        .trim()
        .toLowerCase();
      if (name && !name.startsWith('#')) pyDeps.add(name);
    });
  }
  const pyproject = readFileOrNull(path.join(dir, 'pyproject.toml'));
  if (pyproject) {
    const depMatch = pyproject.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depMatch) {
      depMatch[1].split('\n').forEach((l) => {
        const name = l
          .trim()
          .replace(/["',]/g, '')
          .split(/[=<>!~[]/)[0]
          .trim()
          .toLowerCase();
        if (name) pyDeps.add(name);
      });
    }
  }

  // Read go deps (go.mod)
  const goDeps = new Set<string>();
  const goMod = readFileOrNull(path.join(dir, 'go.mod'));
  if (goMod) {
    const lines = goMod.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([a-zA-Z0-9./_-]+)\s+v[0-9]/);
      if (match) {
        // e.g. github.com/gin-gonic/gin -> gin
        const parts = match[1].toLowerCase().split('/');
        parts.forEach((p) => goDeps.add(p));
      }
    }
  }

  // 1. LANGUAGES
  if (
    hasFile('tsconfig.json') ||
    hasExtension('.ts') ||
    hasExtension('.tsx') ||
    'typescript' in jsDeps
  ) {
    languages.add('TypeScript');
  }
  if (
    hasExtension('.js') ||
    hasExtension('.jsx') ||
    hasExtension('.mjs') ||
    hasExtension('.cjs') ||
    pkgContent
  ) {
    languages.add('JavaScript');
  }
  if (
    hasFile('requirements.txt') ||
    hasFile('Pipfile') ||
    hasFile('pyproject.toml') ||
    hasExtension('.py')
  ) {
    languages.add('Python');
  }
  if (hasFile('go.mod') || hasExtension('.go')) {
    languages.add('Go');
  }
  if (hasFile('Cargo.toml') || hasExtension('.rs')) {
    languages.add('Rust');
  }
  if (hasFile('pom.xml') || hasFile('build.gradle') || hasExtension('.java')) {
    languages.add('Java');
  }
  if (hasFile('build.gradle.kts') || hasExtension('.kt')) {
    languages.add('Kotlin');
  }
  if (hasFile('Gemfile') || hasExtension('.rb')) {
    languages.add('Ruby');
  }
  if (hasFile('composer.json') || hasExtension('.php')) {
    languages.add('PHP');
  }

  // 2. FRAMEWORKS
  // JS/TS Frontend Frameworks
  if ('next' in jsDeps) frameworks.add('Next.js');
  if ('nuxt' in jsDeps || 'nuxt3' in jsDeps) frameworks.add('Nuxt');
  if ('@remix-run/react' in jsDeps || 'remix' in jsDeps) frameworks.add('Remix');
  if ('astro' in jsDeps) frameworks.add('Astro');
  if ('@sveltejs/kit' in jsDeps) frameworks.add('SvelteKit');
  if ('react' in jsDeps) frameworks.add('React');
  if ('vue' in jsDeps) frameworks.add('Vue');
  if ('@angular/core' in jsDeps) frameworks.add('Angular');
  if ('svelte' in jsDeps) frameworks.add('Svelte');
  if ('solid-js' in jsDeps) frameworks.add('Solid');
  // JS/TS Backend Frameworks
  if ('express' in jsDeps) frameworks.add('Express');
  if ('@nestjs/core' in jsDeps) frameworks.add('NestJS');
  if ('koa' in jsDeps) frameworks.add('Koa');
  if ('fastify' in jsDeps) frameworks.add('Fastify');

  // Python Frameworks
  if (pyDeps.has('fastapi')) frameworks.add('FastAPI');
  if (pyDeps.has('flask')) frameworks.add('Flask');
  if (pyDeps.has('django')) frameworks.add('Django');

  // Ruby Frameworks
  if (hasFile('Gemfile') && readFileOrNull(path.join(dir, 'Gemfile'))?.includes('rails')) {
    frameworks.add('Ruby on Rails');
  }

  // Go Frameworks
  if (goDeps.has('gin') || goDeps.has('gin-gonic')) frameworks.add('Gin');
  if (goDeps.has('fiber')) frameworks.add('Fiber');
  if (goDeps.has('beego')) frameworks.add('Beego');
  if (goDeps.has('echo')) frameworks.add('Echo');

  // Java/Kotlin Frameworks
  const gradleFile =
    readFileOrNull(path.join(dir, 'build.gradle')) ||
    readFileOrNull(path.join(dir, 'build.gradle.kts'));
  const pomFile = readFileOrNull(path.join(dir, 'pom.xml'));
  if (
    gradleFile?.includes('spring-boot') ||
    gradleFile?.includes('springboot') ||
    pomFile?.includes('spring-boot') ||
    pomFile?.includes('springboot')
  ) {
    frameworks.add('Spring Boot');
  }

  // 3. TOOLS / LIBRARIES
  if ('vitest' in jsDeps) tools.add('Vitest');
  if ('jest' in jsDeps) tools.add('Jest');
  if ('eslint' in jsDeps) tools.add('ESLint');
  if ('prettier' in jsDeps) tools.add('Prettier');
  if ('tailwindcss' in jsDeps) tools.add('Tailwind CSS');
  if ('prisma' in jsDeps) tools.add('Prisma');
  if ('drizzle-orm' in jsDeps) tools.add('Drizzle ORM');
  if ('vite' in jsDeps) tools.add('Vite');
  if ('webpack' in jsDeps) tools.add('Webpack');
  if ('rollup' in jsDeps) tools.add('Rollup');
  if ('esbuild' in jsDeps) tools.add('esbuild');

  if (
    hasFile('Dockerfile') ||
    hasFile('docker-compose.yml') ||
    hasFile('docker-compose.yaml') ||
    hasFile('compose.yaml')
  ) {
    tools.add('Docker');
  }
  if (hasFile('.github/workflows') || fileTree.some((f) => f.startsWith('.github/workflows/'))) {
    tools.add('GitHub Actions');
  }
  if (hasFile('.gitlab-ci.yml')) {
    tools.add('GitLab CI');
  }

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    tools: Array.from(tools),
  };
}
