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

  it('returns available: true and no missing when node is found', () => {
    execFileSync.mockReturnValue('v20.0.0');

    const result = checkCodegraphCli(tmpDir);

    expect(result).toEqual({ available: true, missing: undefined });
    expect(execFileSync).toHaveBeenCalledWith('node', ['--version'], expect.any(Object));
  });

  it('returns available: false and marks node as missing if node check throws', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('Not found');
    });

    const result = checkCodegraphCli(tmpDir);

    expect(result).toEqual({
      available: false,
      missing: ['node'],
    });
  });
});
