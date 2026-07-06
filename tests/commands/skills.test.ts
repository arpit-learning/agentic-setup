import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { writeProjectConfig, DEFAULT_PROJECT_CONFIG } from '../../src/lib/project-config.js';

// Mock clack prompts and llm calls
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  confirm: vi.fn(() => Promise.resolve(true)),
  multiselect: vi.fn((opts: any) => Promise.resolve(opts.options.map((o: any) => o.value))),
  text: vi.fn(() => Promise.resolve('mocked-input')),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../../src/llm/index.js', () => ({
  validateModel: vi.fn(() => Promise.resolve()),
}));

describe('skills commands', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-skills-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    writeProjectConfig({
      ...DEFAULT_PROJECT_CONFIG,
      agents: ['claude', 'cursor'],
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('lists active skills correctly', async () => {
    const { skillsListCommand } = await import('../../src/commands/skills.js');

    // Create a mock skill file for cursor
    const skillDir = path.join('.cursor', 'skills', 'react-hooks');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: react-hooks\ndescription: React hooks patterns\n---\nRules for hooks',
    );

    const consoleLogs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => consoleLogs.push(msg);

    try {
      await skillsListCommand();
    } finally {
      console.log = origLog;
    }

    const logOutput = consoleLogs.join('\n');
    expect(logOutput).toContain('[cursor]');
    expect(logOutput).toContain('react-hooks');
    expect(logOutput).toContain('React hooks patterns');
  });

  it('generates skills dry-run works', async () => {
    const { skillsGenerateCommand } = await import('../../src/commands/skills.js');

    const consoleLogs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => consoleLogs.push(msg);

    try {
      await skillsGenerateCommand({ dryRun: true, autoApprove: true });
    } finally {
      console.log = origLog;
    }

    const logOutput = consoleLogs.join('\n');
    expect(logOutput).toContain('[Dry run] Would generate skills for topics:');
    expect(logOutput).toContain('development-workflow');
    expect(logOutput).toContain('testing-guide');
  });

  it('deletes skill correctly', async () => {
    const { skillsDeleteCommand } = await import('../../src/commands/skills.js');

    const skillDir = path.join('.cursor', 'skills', 'testing-guide');
    fs.mkdirSync(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, '---\nname: testing-guide\ndescription: Test guidelines\n---\nTest rules');

    expect(fs.existsSync(skillPath)).toBe(true);

    const consoleLogs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => consoleLogs.push(msg);

    try {
      await skillsDeleteCommand('testing-guide');
    } finally {
      console.log = origLog;
    }

    expect(fs.existsSync(skillPath)).toBe(false);
  });
});
