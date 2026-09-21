import { describe, it, expect } from '@jest/globals';
import {
  inputTokens,
  resolveInputBorderColor,
  resolveInputBackgroundColor,
} from '@/constants/theme';

describe('centralised input tokens', () => {
  it('exposes the shared focus/blur/error colours', () => {
    expect(inputTokens.borderFocused).toBe('#007AFF');
    expect(inputTokens.borderError).toBe('#D63228');
    expect(typeof inputTokens.border).toBe('string');
  });

  it('prefers the error colour over focus', () => {
    expect(resolveInputBorderColor({ focused: true, error: true })).toBe(inputTokens.borderError);
  });

  it('returns the focus colour when focused', () => {
    expect(resolveInputBorderColor({ focused: true })).toBe(inputTokens.borderFocused);
  });

  it('falls back to the resting border colour', () => {
    expect(resolveInputBorderColor()).toBe(inputTokens.border);
  });

  it('prefers the disabled background', () => {
    expect(resolveInputBackgroundColor({ disabled: true, focused: true })).toBe(
      inputTokens.backgroundDisabled
    );
  });

  it('returns the error background when invalid', () => {
    expect(resolveInputBackgroundColor({ error: true })).toBe(inputTokens.backgroundError);
  });
});
