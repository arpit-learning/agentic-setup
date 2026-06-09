import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import crypto from 'crypto';
import { readManifest, writeManifest, fileChecksum, Manifest } from '../manifest.js';

vi.mock('fs');

vi.mock('../../constants.js', () => ({
  AGENTIC_DIR: '.agentic-setup',
  MANIFEST_FILE: '.agentic-setup/manifest.json',
}));

describe('readManifest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when manifest does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readManifest()).toBeNull();
  });

  it('returns parsed manifest when file exists', () => {
    const manifest: Manifest = {
      version: 1,
      entries: [{ path: 'CLAUDE.md', action: 'created', checksum: 'abc', timestamp: '2024-01-01' }],
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(manifest) as any);

    expect(readManifest()).toEqual(manifest);
  });

  it('returns null on invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not json' as any);
    expect(readManifest()).toBeNull();
  });
});

describe('writeManifest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates directory and writes manifest', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const manifest: Manifest = {
      version: 1,
      entries: [],
    };
    writeManifest(manifest);

    expect(fs.mkdirSync).toHaveBeenCalledWith('.agentic-setup', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '.agentic-setup/manifest.json',
      JSON.stringify(manifest, null, 2),
    );
  });

  it('skips mkdir when directory exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    writeManifest({ version: 1, entries: [] });
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe('fileChecksum', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes SHA-256 hash of file contents', () => {
    const content = Buffer.from('hello world');
    vi.mocked(fs.readFileSync).mockReturnValue(content as any);

    const expected = crypto.createHash('sha256').update(content).digest('hex');
    expect(fileChecksum('/test/file.txt')).toBe(expected);
  });
});
