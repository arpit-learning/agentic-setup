import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  parseProjectConfig,
  readProjectConfig,
  writeProjectConfig,
  DEFAULT_PROJECT_CONFIG,
  formatProjectConfig,
} from '../project-config.js';

describe('project-config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const config = readProjectConfig(tmpDir);
    expect(config.agents).toEqual(DEFAULT_PROJECT_CONFIG.agents);
    expect(config.readiness_threshold).toBe(60);
  });

  it('parses yaml-like config', () => {
    const config = parseProjectConfig(`
version: 1
agents: [claude, cursor]
profile: api-only
codegraph: false
readiness_threshold: 75
ignore:
  - vendor/
run:
  generate: true
`);
    expect(config.profile).toBe('api-only');
    expect(config.codegraph).toBe(false);
    expect(config.readiness_threshold).toBe(75);
    expect(config.ignore).toEqual(['vendor/']);
  });

  it('writes root and internal config copies', () => {
    writeProjectConfig({ ...DEFAULT_PROJECT_CONFIG, profile: 'ui-feature' }, tmpDir);
    const root = path.join(tmpDir, '.agentic-setup.yaml');
    const internal = path.join(tmpDir, '.agentic-setup', 'project.yaml');
    expect(fs.existsSync(root)).toBe(true);
    expect(fs.existsSync(internal)).toBe(true);
    expect(fs.readFileSync(root, 'utf-8')).toContain('profile: ui-feature');
    expect(readProjectConfig(tmpDir).profile).toBe('ui-feature');
  });

  it('round-trips through formatProjectConfig', () => {
    const formatted = formatProjectConfig(DEFAULT_PROJECT_CONFIG);
    const parsed = parseProjectConfig(formatted);
    expect(parsed.agents).toEqual(DEFAULT_PROJECT_CONFIG.agents);
    expect(parsed.run.generate).toBe(true);
  });
});
