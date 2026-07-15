import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ciInitCommand } from '../../src/commands/ci.js';

vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn().mockResolvedValue(['common/agentic-sync.yml']),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}));

describe('ciInitCommand', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-ci-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes agentic-sync.yml from packaged template', async () => {
    await ciInitCommand();
    const out = path.join('.github', 'workflows', 'agentic-sync.yml');
    expect(fs.existsSync(out)).toBe(true);
    const content = fs.readFileSync(out, 'utf-8');
    expect(content).toContain('agentic-setup check');
    expect(content).toContain('name: agentic-setup Sync');
    expect(content).toContain('arpit-pm1/agentic-setup@v1');
  });

  it('dry-run does not write workflow file', async () => {
    await ciInitCommand({ dryRun: true });
    expect(fs.existsSync(path.join('.github', 'workflows', 'agentic-sync.yml'))).toBe(false);
  });

  it('does not overwrite without --force', async () => {
    await ciInitCommand();
    const out = path.join('.github', 'workflows', 'agentic-sync.yml');
    fs.writeFileSync(out, '# custom\n');
    await ciInitCommand();
    expect(fs.readFileSync(out, 'utf-8')).toBe('# custom\n');
  });

  it('overwrites with --force', async () => {
    await ciInitCommand();
    const out = path.join('.github', 'workflows', 'agentic-sync.yml');
    fs.writeFileSync(out, '# custom\n');
    await ciInitCommand({ force: true });
    expect(fs.readFileSync(out, 'utf-8')).toContain('agentic-setup check');
  });
});
