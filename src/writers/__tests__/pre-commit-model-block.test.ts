import { describe, it, expect } from 'vitest';
import { appendModelBlock, hasModelBlock } from '../pre-commit-block.js';
import { DEFAULT_MODELS } from '../../llm/config.js';

describe('appendModelBlock / hasModelBlock', () => {
  it('hasModelBlock is true when managed marker present', () => {
    expect(hasModelBlock('x\n<!-- agentic:managed:model-config -->\n')).toBe(true);
  });

  it('hasModelBlock is false without marker', () => {
    expect(hasModelBlock('# Only docs')).toBe(false);
  });

  it('appendModelBlock adds block with default model from config', () => {
    const out = appendModelBlock('# Hello');
    expect(out).toContain('<!-- agentic:managed:model-config -->');
    expect(out).toContain(DEFAULT_MODELS.anthropic);
    expect(out).toContain('## Model Configuration');
    expect(out).toContain('high effort');
    expect(out).toContain('AGENTIC_SETUP_MODEL');
  });

  it('appendModelBlock is idempotent when marker exists', () => {
    const once = appendModelBlock('# A');
    expect(appendModelBlock(once)).toBe(once);
  });
});
