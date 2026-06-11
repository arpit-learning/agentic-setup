import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileSync = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  execFileSync,
}));

import { checkCodegraphCli } from '../../src/extensions/codegraph.js';

describe('checkCodegraphCli', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-cg-'));
    execFileSync.mockReset();
  });

  it('does not invoke npx -y (avoids cold-cache downloads in CI)', () => {
    checkCodegraphCli(tmpDir);

    const npxCalls = execFileSync.mock.calls.filter(([cmd]) => cmd === 'npx');
    for (const [, args] of npxCalls) {
      expect(args).not.toContain('-y');
    }
  });

  it('uses npx --no-install when no local binary exists', () => {
    checkCodegraphCli(tmpDir);

    expect(execFileSync).toHaveBeenCalledWith(
      'npx',
      ['--no-install', 'codegraph-ai', '--version'],
      expect.objectContaining({ timeout: 3_000 }),
    );
  });

  it('prefers node_modules/.bin over npx', () => {
    const binDir = path.join(tmpDir, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const localBin = path.join(binDir, 'codegraph-ai');
    fs.writeFileSync(localBin, '#!/bin/sh\necho 1.0.0\n');
    execFileSync.mockReturnValue('1.0.0');

    const result = checkCodegraphCli(tmpDir);

    expect(result).toEqual({ available: true, version: '1.0.0' });
    expect(execFileSync).toHaveBeenCalledWith(
      localBin,
      ['--version'],
      expect.objectContaining({ timeout: 3_000 }),
    );
    expect(execFileSync).not.toHaveBeenCalledWith('npx', expect.any(Array), expect.any(Object));
  });
});
