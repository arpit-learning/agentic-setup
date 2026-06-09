import { describe, it, expect } from 'vitest';
import { detectProfile, resolveProfile } from '../index.js';
import type { Fingerprint } from '../../fingerprint/index.js';

const base: Fingerprint = {
  languages: [],
  frameworks: [],
  tools: [],
  fileTree: [],
  existingConfigs: {},
};

describe('profiles', () => {
  it('detects ui-feature for react', () => {
    const fp: Fingerprint = {
      ...base,
      frameworks: ['React'],
    };
    expect(detectProfile(fp)).toBe('ui-feature');
  });

  it('detects java-service', () => {
    const fp: Fingerprint = {
      ...base,
      languages: ['Java'],
      fileTree: ['pom.xml'],
    };
    expect(detectProfile(fp)).toBe('java-service');
  });

  it('resolveProfile uses configured profile when not auto', () => {
    const hints = resolveProfile('api-only', base);
    expect(hints.profile).toBe('api-only');
    expect(hints.promptFragment).toContain('REST');
  });
});
