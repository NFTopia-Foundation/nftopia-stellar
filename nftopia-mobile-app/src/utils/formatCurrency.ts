/**
 * Shared currency/crypto formatting helpers.
 *
 * These are used by the balance display, the `FormattedCurrency` component and
 * the price service so that symbol placement, decimal precision and locale
 * handling stay consistent across every screen.
 */

export interface FormatCurrencyOptions {
  /** ISO 4217 code, e.g. `USD`. Defaults to `USD`. */
  currency?: string;
  /** BCP-47 locale, e.g. `en-US`. Defaults to the runtime locale. */
  locale?: string;
  /** Minimum fraction digits shown. Defaults to `2`. */
  minimumFractionDigits?: number;
  /** Maximum fraction digits shown. Defaults to `2`. */
  maximumFractionDigits?: number;
  /** Value returned when the input cannot be formatted. Defaults to `'--'`. */
  fallback?: string;
}

/**
 * Converts a loosely typed amount into a finite number.
 * Returns `null` for `null`/`undefined`, empty strings and `NaN`.
 */
export function parseAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  return parsed;
}

/**
 * Formats an amount as fiat, e.g. `$12.34`. Never throws: invalid currency
 * codes fall back to a plain number with the code suffix, invalid amounts fall
 * back to `fallback`.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const {
    currency = 'USD',
    locale,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    fallback = '--',
  } = options;

  const numeric = parseAmount(amount);
  if (numeric === null) return fallback;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numeric);
  } catch {
    // Unknown/invalid ISO code: degrade to a readable number + code.
    try {
      const number = new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(numeric);
      return `${number} ${currency}`;
    } catch {
      return `${numeric} ${currency}`;
    }
  }
}

export interface FormatCryptoOptions {
  /** Maximum fraction digits shown. Defaults to `4`. */
  maxFractionDigits?: number;
  /** Minimum fraction digits shown. Defaults to `0`. */
  minFractionDigits?: number;
  /** Locale used for grouping/separators. */
  locale?: string;
  /** Value returned when the input cannot be formatted. Defaults to `'--'`. */
  fallback?: string;
}

/**
 * Formats a raw crypto/asset amount without a currency symbol, trimming
 * trailing zeros so `1.5000` renders as `1.5` and `2` renders as `2`.
 */
export function formatCryptoAmount(
  amount: number | string | null | undefined,
  options: FormatCryptoOptions = {}
): string {
  const {
    maxFractionDigits = 4,
    minFractionDigits = 0,
    locale,
    fallback = '--',
  } = options;

  const numeric = parseAmount(amount);
  if (numeric === null) return fallback;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    }).format(numeric);
  } catch {
    return String(numeric);
  }
}

/**
 * Multiplies an asset amount by a fiat-per-asset rate.
 * Returns `null` when either operand is missing, non-finite or the rate is
 * negative, so callers can hide the fiat value instead of rendering garbage.
 */
export function convertToFiat(
  amount: number | string | null | undefined,
  rate: number | null | undefined
): number | null {
  const numericAmount = parseAmount(amount);
  if (numericAmount === null) return null;
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate < 0) {
    return null;
  }
  const converted = numericAmount * rate;
  return Number.isFinite(converted) ? converted : null;
}
