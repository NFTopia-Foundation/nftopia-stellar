import { formatCurrency, formatCurrencyCompact } from '../formatCurrency';

describe('formatCurrency', () => {
  it('formats a positive USD amount with the default locale', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats a negative amount', () => {
    expect(formatCurrency(-42.1)).toBe('-$42.10');
  });

  it('rounds to the configured fraction digits', () => {
    expect(formatCurrency(1.005)).toMatch(/^\$1\.0[01]$/); // float rounding is engine-dependent at this exact boundary
    expect(formatCurrency(1.999)).toBe('$2.00');
  });

  it('honors an explicit currency code', () => {
    expect(formatCurrency(10, { currency: 'EUR', locale: 'en-US' })).toBe('€10.00');
  });

  it('honors an explicit locale', () => {
    // German locale uses a comma decimal separator and a trailing € symbol
    // (ICU may join them with a non-breaking space, so check content, not
    // the exact whitespace character).
    const result = formatCurrency(1234.5, { currency: 'EUR', locale: 'de-DE' });
    expect(result).toContain('1.234,50');
    expect(result).toContain('€');
  });

  it('honors custom fraction digit bounds', () => {
    expect(
      formatCurrency(1.23456, { minimumFractionDigits: 0, maximumFractionDigits: 4 }),
    ).toBe('$1.2346');
  });

  it('returns "--" for NaN', () => {
    expect(formatCurrency(NaN)).toBe('--');
  });

  it('returns "--" for Infinity', () => {
    expect(formatCurrency(Infinity)).toBe('--');
    expect(formatCurrency(-Infinity)).toBe('--');
  });

  it('falls back to a plain "<amount> <CODE>" string for an invalid currency code rather than throwing', () => {
    expect(() => formatCurrency(10, { currency: 'NOT_A_CODE' })).not.toThrow();
    expect(formatCurrency(10, { currency: 'NOT_A_CODE' })).toBe('10.00 NOT_A_CODE');
  });
});

describe('formatCurrencyCompact', () => {
  it('uses the standard 2-decimal format for amounts at or above one cent', () => {
    expect(formatCurrencyCompact(0.5)).toBe('$0.50');
    expect(formatCurrencyCompact(0.01)).toBe('$0.01');
  });

  it('expands precision for sub-cent amounts so they do not round to zero', () => {
    const result = formatCurrencyCompact(0.0001234);
    expect(result).not.toBe('$0.00');
    expect(result).toMatch(/^\$0\.0001/);
  });

  it('formats exactly zero using the standard format, not the expanded one', () => {
    expect(formatCurrencyCompact(0)).toBe('$0.00');
  });

  it('returns "--" for non-finite input', () => {
    expect(formatCurrencyCompact(NaN)).toBe('--');
  });
});
