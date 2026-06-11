import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mocks = vi.hoisted(() => ({
  hooksCommand: vi.fn(async () => undefined),
  initCommand: vi.fn(async () => undefined),
  codegraphSetupCommand: vi.fn(async () => undefined),
  analyzeCommand: vi.fn(async () => undefined),
  compositeScoreCommand: vi.fn(async () => undefined),
  doctorCommand: vi.fn(async () => undefined),
}));

vi.mock('../../src/commands/hooks.js', () => ({ hooksCommand: mocks.hooksCommand }));
vi.mock('../../src/commands/init.js', () => ({ initCommand: mocks.initCommand }));
vi.mock('../../src/commands/codegraph.js', () => ({ codegraphSetupCommand: mocks.codegraphSetupCommand }));
vi.mock('../../src/commands/analyze.js', () => ({ analyzeCommand: mocks.analyzeCommand }));
vi.mock('../../src/commands/composite-score.js', () => ({ compositeScoreCommand: mocks.compositeScoreCommand }));
vi.mock('../../src/commands/doctor.js', () => ({ doctorCommand: mocks.doctorCommand }));

import { setupCommand } from '../../src/commands/setup.js';
import { writeProjectConfig } from '../../src/lib/project-config.js';

describe('setupCommand', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-setup-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not include bootstrap in pipeline steps (json)', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await setupCommand({ dryRun: true, json: true });
    } finally {
      console.log = orig;
    }

    const payload = JSON.parse(logs[0]) as {
      steps: Array<{ name: string; status: string }>;
      dry_run: boolean;
    };
    const names = payload.steps.map((s) => s.name);
    expect(names).not.toContain('bootstrap');
    expect(names).toEqual(['hooks', 'init', 'codegraph', 'analyze', 'readiness', 'doctor']);
    expect(payload.dry_run).toBe(true);
    expect(payload.steps.every((s) => s.status === 'skipped')).toBe(true);
  });

  it('dry-run does not invoke subcommands', async () => {
    await setupCommand({ dryRun: true, json: true });
    expect(mocks.hooksCommand).not.toHaveBeenCalled();
    expect(mocks.initCommand).not.toHaveBeenCalled();
    expect(mocks.codegraphSetupCommand).not.toHaveBeenCalled();
    expect(mocks.analyzeCommand).not.toHaveBeenCalled();
    expect(mocks.compositeScoreCommand).not.toHaveBeenCalled();
    expect(mocks.doctorCommand).not.toHaveBeenCalled();
  });

  it('runs hooks → init → codegraph → analyze → readiness → doctor in order', async () => {
    const callOrder: string[] = [];
    mocks.hooksCommand.mockImplementation(async () => {
      callOrder.push('hooks');
    });
    mocks.initCommand.mockImplementation(async () => {
      callOrder.push('init');
    });
    mocks.codegraphSetupCommand.mockImplementation(async () => {
      callOrder.push('codegraph');
    });
    mocks.analyzeCommand.mockImplementation(async () => {
      callOrder.push('analyze');
    });
    mocks.compositeScoreCommand.mockImplementation(async () => {
      callOrder.push('readiness');
    });
    mocks.doctorCommand.mockImplementation(async () => {
      callOrder.push('doctor');
    });

    await setupCommand({ autoApprove: true, agent: ['claude'] });

    expect(callOrder).toEqual(['hooks', 'init', 'codegraph', 'analyze', 'readiness', 'doctor']);
    expect(mocks.hooksCommand).toHaveBeenCalledWith({ install: true });
    expect(mocks.initCommand).toHaveBeenCalledWith(
      expect.objectContaining({ autoApprove: true, agent: ['claude'] }),
    );
  });

  it('skip-llm skips init but still runs hooks and extensions', async () => {
    writeProjectConfig({
      version: 1,
      agents: ['claude'],
      profile: 'auto',
      codegraph: false,
      analyze_on_setup: false,
      readiness_threshold: 60,
      config_score_threshold: 60,
      ignore: [],
      run: { generate: true },
      ci: { workflow: false },
    });

    const callOrder: string[] = [];
    mocks.hooksCommand.mockImplementation(async () => {
      callOrder.push('hooks');
    });
    mocks.compositeScoreCommand.mockImplementation(async () => {
      callOrder.push('readiness');
    });
    mocks.doctorCommand.mockImplementation(async () => {
      callOrder.push('doctor');
    });

    await setupCommand({ skipLlm: true, json: true });

    expect(callOrder).toEqual(['hooks', 'readiness', 'doctor']);
    expect(mocks.initCommand).not.toHaveBeenCalled();
  });

  it('skip-codegraph skips codegraph when enabled in config', async () => {
    writeProjectConfig({
      version: 1,
      agents: ['claude'],
      profile: 'auto',
      codegraph: true,
      analyze_on_setup: false,
      readiness_threshold: 60,
      config_score_threshold: 60,
      ignore: [],
      run: { generate: true },
      ci: { workflow: false },
    });

    await setupCommand({ skipCodegraph: true, skipLlm: true, json: true });

    expect(mocks.codegraphSetupCommand).not.toHaveBeenCalled();
    expect(mocks.analyzeCommand).not.toHaveBeenCalled();
  });

  it('writes .agentic-setup.yaml when not dry-run', async () => {
    writeProjectConfig({
      version: 1,
      agents: ['cursor'],
      profile: 'auto',
      codegraph: false,
      analyze_on_setup: false,
      readiness_threshold: 60,
      config_score_threshold: 60,
      ignore: [],
      run: { generate: true },
      ci: { workflow: false },
    });
    await setupCommand({ skipLlm: true, skipCodegraph: true, agent: ['cursor'] });
    expect(fs.existsSync('.agentic-setup.yaml')).toBe(true);
    const content = fs.readFileSync('.agentic-setup.yaml', 'utf-8');
    expect(content).toContain('cursor');
  });
});
