import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export interface StaticScanResult {
  lint: { ran: boolean; ok: boolean; summary: string };
  security: { ran: boolean; ok: boolean; summary: string };
  tests: { source_count: number; test_count: number; ratio: number };
  ci_present: boolean;
}

const CI_FILES = ['.github/workflows', 'Jenkinsfile', '.gitlab-ci.yml', 'bitbucket-pipelines.yml'];

function commandExists(cmd: string): boolean {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function countFiles(repoRoot: string, patterns: RegExp[], ignore: RegExp[]): number {
  let count = 0;
  function walk(dir: string, depth: number): void {
    if (depth > 6) return;
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = path.relative(repoRoot, path.join(dir, entry));
      if (ignore.some((r) => r.test(rel) || r.test(entry))) continue;
      const full = path.join(dir, entry);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full, depth + 1);
        else if (patterns.some((p) => p.test(rel))) count++;
      } catch {
        // skip
      }
    }
  }
  walk(repoRoot, 0);
  return count;
}

function detectLintCommand(repoRoot: string): string | null {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        scripts?: Record<string, string>;
      };
      if (pkg.scripts?.lint) return 'npm run lint';
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(path.join(repoRoot, 'build.gradle')))
    return './gradlew checkstyleMain --no-daemon';
  if (fs.existsSync(path.join(repoRoot, 'pyproject.toml'))) return 'ruff check .';
  return null;
}

export function runStaticScans(
  repoRoot: string,
  options: { skipLint?: boolean; skipSecurity?: boolean } = {},
): StaticScanResult {
  const result: StaticScanResult = {
    lint: { ran: false, ok: true, summary: 'not configured' },
    security: { ran: false, ok: true, summary: 'not installed' },
    tests: { source_count: 0, test_count: 0, ratio: 0 },
    ci_present: CI_FILES.some((f) => fs.existsSync(path.join(repoRoot, f))),
  };

  const lintCmd = detectLintCommand(repoRoot);
  if (!options.skipLint && lintCmd) {
    try {
      execFileSync(lintCmd, {
        cwd: repoRoot,
        encoding: 'utf-8',
        shell: true,
        timeout: 300_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      result.lint = { ran: true, ok: true, summary: 'clean' };
    } catch (err: unknown) {
      const e = err as { stderr?: string; stdout?: string };
      result.lint = {
        ran: true,
        ok: false,
        summary: (e.stderr || e.stdout || 'failed').slice(0, 200),
      };
    }
  }

  if (!options.skipSecurity) {
    if (commandExists('gitleaks')) {
      try {
        const out = execFileSync('gitleaks detect --no-git -v 2>&1 || true', {
          cwd: repoRoot,
          encoding: 'utf-8',
          shell: true,
          timeout: 120_000,
        });
        const clean = !out.toLowerCase().includes('leak');
        result.security = {
          ran: true,
          ok: clean,
          summary: clean ? 'no leaks' : 'potential secrets',
        };
      } catch {
        result.security = { ran: true, ok: false, summary: 'scan failed' };
      }
    }
  }

  const ignore = [/node_modules/, /\.git/, /dist/, /build/, /target/];
  const source = countFiles(
    repoRoot,
    [/\.java$/, /\.ts$/, /\.tsx$/, /\.py$/, /\.go$/],
    [...ignore, /test/, /tests/, /__tests__/],
  );
  const test = countFiles(
    repoRoot,
    [/Test\.java$/, /\.test\.[jt]sx?$/, /test_.*\.py$/, /_test\.go$/],
    ignore,
  );
  result.tests = {
    source_count: source,
    test_count: test,
    ratio: source > 0 ? test / source : 0,
  };

  return result;
}
