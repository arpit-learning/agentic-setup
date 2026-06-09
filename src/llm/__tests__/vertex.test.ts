import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MockAnthropicVertex, MockGoogleAuth } = vi.hoisted(() => ({
  MockAnthropicVertex: vi.fn().mockImplementation(function () {
    return { messages: { create: vi.fn(), stream: vi.fn() } };
  }),
  MockGoogleAuth: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

vi.mock('@anthropic-ai/vertex-sdk', () => ({
  AnthropicVertex: MockAnthropicVertex,
}));

vi.mock('google-auth-library', () => ({
  GoogleAuth: MockGoogleAuth,
}));

import fs from 'fs';
import { VertexProvider } from '../vertex.js';

describe('VertexProvider constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when projectId is missing', () => {
    expect(() => new VertexProvider({ provider: 'vertex', model: 'test' })).toThrow(
      'VERTEX_PROJECT_ID / GCP_PROJECT_ID is required',
    );
  });

  it('creates client without credentials (ADC)', () => {
    new VertexProvider({ provider: 'vertex', model: 'test', vertexProjectId: 'proj' });
    expect(MockAnthropicVertex).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj', region: 'us-east5' }),
    );
    expect(MockGoogleAuth).not.toHaveBeenCalled();
  });

  it('uses custom region', () => {
    new VertexProvider({
      provider: 'vertex',
      model: 'test',
      vertexProjectId: 'proj',
      vertexRegion: 'europe-west1',
    });
    expect(MockAnthropicVertex).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'europe-west1' }),
    );
  });

  it('parses inline JSON credentials', () => {
    const creds = JSON.stringify({ type: 'service_account', project_id: 'proj' });
    new VertexProvider({
      provider: 'vertex',
      model: 'test',
      vertexProjectId: 'proj',
      vertexCredentials: creds,
    });
    expect(MockGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: { type: 'service_account', project_id: 'proj' },
      }),
    );
  });

  it('throws on invalid inline JSON credentials', () => {
    expect(
      () =>
        new VertexProvider({
          provider: 'vertex',
          model: 'test',
          vertexProjectId: 'proj',
          vertexCredentials: '{bad json',
        }),
    ).toThrow('VERTEX_SA_CREDENTIALS must be valid JSON');
  });

  it('reads credentials from file path', () => {
    const creds = { type: 'service_account', project_id: 'proj' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(creds));

    new VertexProvider({
      provider: 'vertex',
      model: 'test',
      vertexProjectId: 'proj',
      vertexCredentials: '/path/to/creds.json',
    });

    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/creds.json', 'utf-8');
    expect(MockGoogleAuth).toHaveBeenCalledWith(expect.objectContaining({ credentials: creds }));
  });

  it('throws when credentials file cannot be read', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(
      () =>
        new VertexProvider({
          provider: 'vertex',
          model: 'test',
          vertexProjectId: 'proj',
          vertexCredentials: '/nonexistent/file.json',
        }),
    ).toThrow('Cannot read credentials file: /nonexistent/file.json');
  });

  it('trims whitespace from credentials before checking format', () => {
    const creds = JSON.stringify({ type: 'service_account' });
    new VertexProvider({
      provider: 'vertex',
      model: 'test',
      vertexProjectId: 'proj',
      vertexCredentials: `  ${creds}  `,
    });
    expect(MockGoogleAuth).toHaveBeenCalled();
  });
});
