import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeProjectConfig, DEFAULT_PROJECT_CONFIG } from '../../lib/project-config.js';

describe('checkCommand', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-check-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    writeProjectConfig({
      ...DEFAULT_PROJECT_CONFIG,
      readiness_threshold: 0,
      config_score_threshold: 0,
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it('fails on empty repo (doctor critical checks)', async () => {
    const { checkCommand } = await import('../check.js');
    await checkCommand({ quiet: true });
    expect(process.exitCode).toBe(1);
  });

  it('outputs json structure', async () => {
    const { checkCommand } = await import('../check.js');
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await checkCommand({ json: true });
    } finally {
      console.log = orig;
    }
    const parsed = JSON.parse(logs[0]) as { passed: boolean; config_score: number };
    expect(typeof parsed.passed).toBe('boolean');
    expect(typeof parsed.config_score).toBe('number');
  });
});
