import { describe, it, expect } from '@jest/globals';
import {
  sanitizeAmountInput,
  isValidAmount,
  getNextHighlightIndex,
} from '@/components/ui/inputUtils';

describe('sanitizeAmountInput', () => {
  it('strips non-numeric characters', () => {
    expect(sanitizeAmountInput('1a2b3')).toBe('123');
  });

  it('keeps a single decimal separator', () => {
    expect(sanitizeAmountInput('12.3.4')).toBe('12.34');
    expect(sanitizeAmountInput('1,5')).toBe('1.5');
  });

  it('limits the number of fraction digits', () => {
    expect(sanitizeAmountInput('1.123456789')).toBe('1.1234567');
    expect(sanitizeAmountInput('1.239', { decimals: 2 })).toBe('1.23');
  });

  it('normalises a leading decimal point', () => {
    expect(sanitizeAmountInput('.5')).toBe('0.5');
  });

  it('strips redundant leading zeros', () => {
    expect(sanitizeAmountInput('007')).toBe('7');
    expect(sanitizeAmountInput('0.5')).toBe('0.5');
  });

  it('keeps partial input while the user is typing', () => {
    expect(sanitizeAmountInput('12.')).toBe('12.');
  });

  it('supports integer-only mode', () => {
    expect(sanitizeAmountInput('12.34', { allowDecimal: false })).toBe('1234');
  });

  it('enforces a maximum integer length', () => {
    expect(sanitizeAmountInput('123456', { maxIntegerDigits: 4 })).toBe('1234');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeAmountInput('')).toBe('');
  });
});

describe('isValidAmount', () => {
  it('accepts well-formed amounts', () => {
    expect(isValidAmount('0')).toBe(true);
    expect(isValidAmount('12')).toBe(true);
    expect(isValidAmount('12.5')).toBe(true);
    expect(isValidAmount('0.0000001')).toBe(true);
  });

  it('rejects malformed amounts', () => {
    expect(isValidAmount('')).toBe(false);
    expect(isValidAmount('12.')).toBe(false);
    expect(isValidAmount('.5')).toBe(false);
    expect(isValidAmount('01')).toBe(false);
    expect(isValidAmount('1.23456789')).toBe(false);
    expect(isValidAmount('abc')).toBe(false);
  });

  it('honours the configured limits', () => {
    expect(isValidAmount('1.234', { decimals: 2 })).toBe(false);
    expect(isValidAmount('1.23', { decimals: 2 })).toBe(true);
    expect(isValidAmount('12345', { maxIntegerDigits: 3 })).toBe(false);
    expect(isValidAmount('12.3', { allowDecimal: false })).toBe(false);
  });
});

describe('getNextHighlightIndex', () => {
  it('returns -1 when there are no options', () => {
    expect(getNextHighlightIndex(-1, 0, 'ArrowDown')).toBe(-1);
  });

  it('moves down and wraps by default', () => {
    expect(getNextHighlightIndex(-1, 3, 'ArrowDown')).toBe(0);
    expect(getNextHighlightIndex(2, 3, 'ArrowDown')).toBe(0);
  });

  it('moves up and wraps by default', () => {
    expect(getNextHighlightIndex(0, 3, 'ArrowUp')).toBe(2);
    expect(getNextHighlightIndex(-1, 3, 'ArrowUp')).toBe(2);
  });

  it('clamps when looping is disabled', () => {
    expect(getNextHighlightIndex(2, 3, 'ArrowDown', false)).toBe(2);
    expect(getNextHighlightIndex(0, 3, 'ArrowUp', false)).toBe(0);
  });

  it('supports Home and End', () => {
    expect(getNextHighlightIndex(2, 5, 'Home')).toBe(0);
    expect(getNextHighlightIndex(1, 5, 'End')).toBe(4);
  });

  it('ignores unrelated keys', () => {
    expect(getNextHighlightIndex(1, 5, 'Enter')).toBe(1);
  });
});
