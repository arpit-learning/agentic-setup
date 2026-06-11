import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getFileTree } from '../../src/fingerprint/file-tree.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-ft-'));
}

function writeWithMtime(filePath: string, content: string, mtime: Date): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  fs.utimesSync(filePath, mtime, mtime);
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {}
  }
  dirs.length = 0;
});

describe('getFileTree', () => {
  it('returns files sorted by mtime descending (most recent first)', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    writeWithMtime(path.join(tmp, 'old.ts'), 'old', new Date('2024-01-01'));
    writeWithMtime(path.join(tmp, 'mid.ts'), 'mid', new Date('2024-06-01'));
    writeWithMtime(path.join(tmp, 'new.ts'), 'new', new Date('2025-01-01'));

    const tree = getFileTree(tmp);
    const files = tree.filter((e) => !e.endsWith('/'));

    expect(files).toEqual(['new.ts', 'mid.ts', 'old.ts']);
  });

  it('returns directories sorted by most-recent child mtime', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    fs.mkdirSync(path.join(tmp, 'dormant'));
    fs.mkdirSync(path.join(tmp, 'active'));

    writeWithMtime(path.join(tmp, 'dormant', 'file.ts'), 'old', new Date('2023-01-01'));
    writeWithMtime(path.join(tmp, 'active', 'file.ts'), 'new', new Date('2025-06-01'));

    const tree = getFileTree(tmp);
    const dirEntries = tree.filter((e) => e.endsWith('/'));

    expect(dirEntries[0]).toBe('active/');
    expect(dirEntries[1]).toBe('dormant/');
  });

  it('directories appear before files in output', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    fs.mkdirSync(path.join(tmp, 'src'));
    writeWithMtime(path.join(tmp, 'src', 'index.ts'), 'code', new Date('2025-01-01'));
    writeWithMtime(path.join(tmp, 'README.md'), 'readme', new Date('2025-06-01'));

    const tree = getFileTree(tmp);
    const firstDir = tree.findIndex((e) => e.endsWith('/'));
    const firstFile = tree.findIndex((e) => !e.endsWith('/'));

    if (firstDir !== -1 && firstFile !== -1) {
      expect(firstDir).toBeLessThan(firstFile);
    }
  });

  it('scores directories by descendant mtime, not own mtime', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    // dir-old has a recent file inside it
    fs.mkdirSync(path.join(tmp, 'dir-old'));
    writeWithMtime(path.join(tmp, 'dir-old', 'recent.ts'), 'new', new Date('2025-12-01'));

    // dir-new is itself recent but has an old file
    fs.mkdirSync(path.join(tmp, 'dir-new'));
    writeWithMtime(path.join(tmp, 'dir-new', 'old.ts'), 'old', new Date('2020-01-01'));

    // Touch dir-new to make its own mtime recent
    fs.utimesSync(path.join(tmp, 'dir-new'), new Date('2025-11-01'), new Date('2025-11-01'));

    const tree = getFileTree(tmp);
    const dirEntries = tree.filter((e) => e.endsWith('/'));

    // dir-old should come first because it contains the most recent FILE
    expect(dirEntries[0]).toBe('dir-old/');
  });

  it('ignores node_modules and .git directories', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    fs.mkdirSync(path.join(tmp, 'node_modules'));
    fs.writeFileSync(path.join(tmp, 'node_modules', 'pkg.js'), 'module');
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'app.ts'), 'code');

    const tree = getFileTree(tmp);

    expect(tree).not.toContain('node_modules/');
    expect(tree.some((e) => e.includes('node_modules'))).toBe(false);
    expect(tree).toContain('src/');
  });

  it('handles empty directory', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    const tree = getFileTree(tmp);
    expect(tree).toEqual([]);
  });

  it('respects maxDepth', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    fs.mkdirSync(path.join(tmp, 'a', 'b', 'c', 'd'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'a', 'b', 'c', 'd', 'deep.ts'), 'deep');
    fs.writeFileSync(path.join(tmp, 'a', 'b', 'shallow.ts'), 'shallow');

    const tree = getFileTree(tmp, 2);

    expect(tree.some((e) => e.includes('shallow.ts'))).toBe(true);
    expect(tree.some((e) => e.includes('deep.ts'))).toBe(false);
  });

  it('handles all files with same mtime gracefully', () => {
    const tmp = makeTempDir();
    dirs.push(tmp);

    const sameMtime = new Date('2025-03-01');
    writeWithMtime(path.join(tmp, 'a.ts'), 'a', sameMtime);
    writeWithMtime(path.join(tmp, 'b.ts'), 'b', sameMtime);
    writeWithMtime(path.join(tmp, 'c.ts'), 'c', sameMtime);

    const tree = getFileTree(tmp);
    const files = tree.filter((e) => !e.endsWith('/'));

    expect(files).toHaveLength(3);
    expect(new Set(files).size).toBe(3);
  });
});
