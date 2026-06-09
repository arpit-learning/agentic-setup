import { describe, it, expect } from 'vitest';
import { compareState, ServerItem, LocalItem } from '../index.js';

function makeServerItem(overrides: Partial<ServerItem> = {}): ServerItem {
  return {
    id: 'si-1',
    type: 'rule',
    platform: 'claude',
    name: 'CLAUDE.md',
    content_hash: 'abc123',
    content: {},
    ...overrides,
  };
}

function makeLocalItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    type: 'rule',
    platform: 'claude',
    name: 'CLAUDE.md',
    contentHash: 'abc123',
    path: '/project/CLAUDE.md',
    ...overrides,
  };
}

describe('compareState', () => {
  it('marks items with matching hashes as installed', () => {
    const server = [makeServerItem()];
    const local = [makeLocalItem()];
    const result = compareState(server, local);

    expect(result.installed).toHaveLength(1);
    expect(result.missing).toHaveLength(0);
    expect(result.outdated).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
  });

  it('marks server items without local match as missing', () => {
    const server = [makeServerItem()];
    const result = compareState(server, []);

    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].name).toBe('CLAUDE.md');
  });

  it('marks items with different hashes as outdated', () => {
    const server = [makeServerItem({ content_hash: 'new-hash' })];
    const local = [makeLocalItem({ contentHash: 'old-hash' })];
    const result = compareState(server, local);

    expect(result.outdated).toHaveLength(1);
    expect(result.outdated[0].server.content_hash).toBe('new-hash');
    expect(result.outdated[0].local.contentHash).toBe('old-hash');
  });

  it('marks local items without server match as extra', () => {
    const local = [makeLocalItem({ name: 'extra-skill.md', type: 'skill' })];
    const result = compareState([], local);

    expect(result.extra).toHaveLength(1);
    expect(result.extra[0].name).toBe('extra-skill.md');
  });

  it('handles mixed state correctly', () => {
    const server = [
      makeServerItem({ name: 'CLAUDE.md', content_hash: 'same' }),
      makeServerItem({ name: 'settings.json', type: 'config', content_hash: 'server-hash' }),
      makeServerItem({ name: 'missing-skill.md', type: 'skill', content_hash: 'x' }),
    ];
    const local = [
      makeLocalItem({ name: 'CLAUDE.md', contentHash: 'same' }),
      makeLocalItem({ name: 'settings.json', type: 'config', contentHash: 'local-hash' }),
      makeLocalItem({ name: 'extra.md', type: 'skill', contentHash: 'y' }),
    ];

    const result = compareState(server, local);
    expect(result.installed).toHaveLength(1);
    expect(result.outdated).toHaveLength(1);
    expect(result.missing).toHaveLength(1);
    expect(result.extra).toHaveLength(1);
  });

  it('matches items by type, platform, and name composite key', () => {
    const server = [makeServerItem({ type: 'mcp', platform: 'cursor', name: 'server-a' })];
    const local = [makeLocalItem({ type: 'mcp', platform: 'claude', name: 'server-a' })];
    const result = compareState(server, local);

    expect(result.missing).toHaveLength(1);
    expect(result.extra).toHaveLength(1);
  });
});
