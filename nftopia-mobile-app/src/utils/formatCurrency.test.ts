import {
  convertToFiat,
  formatCryptoAmount,
  formatCurrency,
  parseAmount,
} from './formatCurrency';

describe('parseAmount', () => {
  it('parses numbers and numeric strings', () => {
    expect(parseAmount(1.5)).toBe(1.5);
    expect(parseAmount('12.34')).toBe(12.34);
    expect(parseAmount('  7 ')).toBe(7);
  });

  it('returns null for missing or non-finite input', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('not-a-number')).toBeNull();
    expect(parseAmount(NaN)).toBeNull();
    expect(parseAmount(Infinity)).toBeNull();
  });
});

describe('formatCurrency', () => {
  it('formats USD with locale-aware symbol placement', () => {
    expect(formatCurrency(12.34, { locale: 'en-US', currency: 'USD' })).toBe('$12.34');
    expect(formatCurrency('0', { locale: 'en-US', currency: 'USD' })).toBe('$0.00');
  });

  it('formats zero and negative amounts', () => {
    expect(formatCurrency(0, { locale: 'en-US' })).toBe('$0.00');
    expect(formatCurrency(-5.5, { locale: 'en-US', currency: 'USD' })).toBe('-$5.50');
  });

  it('supports currencies other than USD', () => {
    expect(formatCurrency(10, { locale: 'en-US', currency: 'EUR' })).toContain('10.00');
    expect(formatCurrency(10, { locale: 'en-US', currency: 'GBP' })).toContain('10.00');
  });

  it('falls back when the amount is invalid', () => {
    expect(formatCurrency(null, { locale: 'en-US' })).toBe('--');
    expect(formatCurrency('abc', { locale: 'en-US', fallback: 'n/a' })).toBe('n/a');
  });

  it('degrades gracefully for an unknown currency code', () => {
    const result = formatCurrency(3.5, { locale: 'en-US', currency: 'NOTACODE' });
    expect(result).toContain('3.50');
    expect(result).toContain('NOTACODE');
  });

  it('honours custom fraction digits', () => {
    const result = formatCurrency(1.23456, {
      locale: 'en-US',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
    expect(result).toBe('$1.2346');
  });
});

describe('formatCryptoAmount', () => {
  it('trims trailing zeros', () => {
    expect(formatCryptoAmount('1.5000', { locale: 'en-US' })).toBe('1.5');
    expect(formatCryptoAmount('2.0000', { locale: 'en-US' })).toBe('2');
    expect(formatCryptoAmount(1000, { locale: 'en-US' })).toBe('1,000');
  });

  it('respects the max fraction digits', () => {
    expect(formatCryptoAmount('1.98765', { locale: 'en-US', maxFractionDigits: 2 })).toBe('1.99');
  });

  it('handles zero, negative and invalid values', () => {
    expect(formatCryptoAmount('0', { locale: 'en-US' })).toBe('0');
    expect(formatCryptoAmount('-3', { locale: 'en-US' })).toBe('-3');
    expect(formatCryptoAmount(null)).toBe('--');
  });
});

describe('convertToFiat', () => {
  it('multiplies an amount by the rate', () => {
    expect(convertToFiat(10, 0.42)).toBeCloseTo(4.2);
    expect(convertToFiat('2.5', 2)).toBeCloseTo(5);
  });

  it('returns zero for a zero rate or zero amount', () => {
    expect(convertToFiat(100, 0)).toBe(0);
    expect(convertToFiat(0, 0.42)).toBe(0);
  });

  it('returns null for negative or invalid rates', () => {
    expect(convertToFiat(10, -1)).toBeNull();
    expect(convertToFiat(10, null)).toBeNull();
    expect(convertToFiat(10, undefined)).toBeNull();
    expect(convertToFiat(10, NaN)).toBeNull();
    expect(convertToFiat(10, Infinity)).toBeNull();
  });

  it('returns null for invalid amounts', () => {
    expect(convertToFiat(null, 0.42)).toBeNull();
    expect(convertToFiat('abc', 0.42)).toBeNull();
  });
});
