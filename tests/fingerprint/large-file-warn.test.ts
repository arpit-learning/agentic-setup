import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printLargeFileWarnings } from '../../src/fingerprint/large-file-warn.js';
import type { LargeFileWarning } from '../../src/fingerprint/large-file-scan.js';

function makeWarning(filePath: string, sizeMB: string): LargeFileWarning {
  const sizeBytes = Math.round(parseFloat(sizeMB) * 1_048_576);
  return { filePath, sizeBytes, sizeMB };
}

describe('printLargeFileWarnings', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('does nothing when warnings array is empty (with spinner)', () => {
    const spinner = { warn: vi.fn() };

    printLargeFileWarnings([], { spinner: spinner as never });

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(spinner.warn).not.toHaveBeenCalled();
  });

  it('does nothing when warnings array is empty (no spinner)', () => {
    printLargeFileWarnings([]);

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('uses singular wording for exactly one warning', () => {
    printLargeFileWarnings([makeWarning('/project/data.csv', '5.00')]);

    const output = String(stderrSpy.mock.calls[0][0]);
    expect(output).toContain('1 large file');
    expect(output).not.toContain('1 large files');
  });

  it('uses plural wording for two or more warnings', () => {
    printLargeFileWarnings([
      makeWarning('/project/data.csv', '5.00'),
      makeWarning('/project/model.pkl', '12.00'),
    ]);

    const output = String(stderrSpy.mock.calls[0][0]);
    expect(output).toContain('2 large files');
  });

  it('includes file path and size for each warning', () => {
    printLargeFileWarnings([
      makeWarning('/project/data.csv', '5.20'),
      makeWarning('/project/model.pkl', '12.75'),
    ]);

    const output = String(stderrSpy.mock.calls[0][0]);
    expect(output).toContain('/project/data.csv');
    expect(output).toContain('5.20 MB');
    expect(output).toContain('/project/model.pkl');
    expect(output).toContain('12.75 MB');
  });

  it('always includes .gitignore and .agentic-setupignore in the hint', () => {
    printLargeFileWarnings([makeWarning('/project/dump.sqlite', '50.00')]);

    const output = String(stderrSpy.mock.calls[0][0]);
    expect(output).toContain('.gitignore');
    expect(output).toContain('.agentic-setupignore');
  });

  it('mentions AI context window in the warning header', () => {
    printLargeFileWarnings([makeWarning('/project/data.csv', '5.00')]);

    const output = String(stderrSpy.mock.calls[0][0]);
    expect(output).toContain('context window');
  });

  it('routes output through spinner.warn() when spinner is provided', () => {
    const spinner = { warn: vi.fn() };

    printLargeFileWarnings([makeWarning('/project/data.csv', '5.00')], {
      spinner: spinner as never,
    });

    expect(spinner.warn).toHaveBeenCalledOnce();
    expect(stderrSpy).not.toHaveBeenCalled();
    const message = String(spinner.warn.mock.calls[0][0]);
    expect(message).toContain('large file');
    expect(message).toContain('/project/data.csv');
  });

  it('writes to process.stderr when no spinner is provided', () => {
    printLargeFileWarnings([makeWarning('/project/data.csv', '5.00')]);

    expect(stderrSpy).toHaveBeenCalled();
    expect(String(stderrSpy.mock.calls[0][0])).toContain('large file');
  });

  it('writes to process.stderr when options object is empty', () => {
    printLargeFileWarnings([makeWarning('/project/dump.db', '8.00')], {});

    expect(stderrSpy).toHaveBeenCalled();
  });
});
