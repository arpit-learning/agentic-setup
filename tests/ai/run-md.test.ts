import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectRunMd, formatRunMd, writeRunMd } from '../../src/ai/run-md.js';
import type { Fingerprint } from '../../src/fingerprint/index.js';

const emptyFp: Fingerprint = {
  languages: [],
  frameworks: [],
  tools: [],
  fileTree: [],
  existingConfigs: {},
};

describe('run-md', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-runmd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects npm dev script', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite', test: 'vitest' } }),
    );
    const content = detectRunMd(tmpDir, emptyFp);
    expect(content.startup_command).toContain('npm run dev');
    expect(content.test_command).toContain('npm test');
  });

  it('writes run.md when missing', () => {
    const { written, path: out } = writeRunMd(tmpDir, emptyFp);
    expect(written).toBe(true);
    expect(fs.existsSync(out)).toBe(true);
    const text = fs.readFileSync(out, 'utf-8');
    expect(text).toContain('base_url');
    expect(text).toContain('health_endpoint');
  });

  it('format includes startup command', () => {
    const md = formatRunMd({
      startup_command: 'npm run dev',
      health_endpoint: '/health',
      base_url: 'http://localhost:3000',
      test_command: 'npm test',
      auth_notes: 'Use .env',
    });
    expect(md).toContain('npm run dev');
    expect(md).toContain('/health');
  });
});
