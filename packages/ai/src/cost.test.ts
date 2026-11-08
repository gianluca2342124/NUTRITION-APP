import { describe, expect, it } from 'vitest';
import { supportsServerFallback } from './anthropic';
import { estimateCostUsd, imageTokens } from './cost';

describe('AI cost estimate', () => {
  it('prices a call from its usage', () => {
    // 5,500 input + 1,500 output tokens on Claude Opus 5.5 ($4 / $20 per MTok)
    expect(estimateCostUsd('claude-opus-5-5', 5_500, 1_500)).toBeCloseTo(0.052, 6);
    // the same on Claude Haiku 5.5 ($0.10 / $0.50)
    expect(estimateCostUsd('claude-haiku-5-5', 5_500, 1_500)).toBeCloseTo(0.0013, 6);
  });

  it('does not guess for unknown models or missing usage', () => {
    expect(estimateCostUsd('some-other-model', 100, 100)).toBeNull();
    expect(estimateCostUsd('claude-opus-5-5', null, 100)).toBeNull();
  });

  it('estimates image tokens from the pixel count', () => {
    expect(imageTokens(1600, 1200)).toBe(2560);
  });

  it('sends the server-side fallback only to models that support it', () => {
    expect(supportsServerFallback('claude-opus-5-5')).toBe(true);
    expect(supportsServerFallback('claude-sonnet-5-5')).toBe(true);
    expect(supportsServerFallback('claude-haiku-5-5')).toBe(false);
  });
});
