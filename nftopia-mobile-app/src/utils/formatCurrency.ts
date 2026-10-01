// Shared fiat-currency formatting (#470) — the one place symbol/decimal/
// locale formatting is decided, so every screen showing a fiat amount
// (Home's balance, a transaction fee, a listing price) renders it
// identically. Pure/no native imports, cheap to unit test.

export interface FormatCurrencyOptions {
  /** ISO 4217 currency code, e.g. 'USD', 'EUR', 'NGN'. Defaults to 'USD'. */
  currency?: string;
  /** BCP 47 locale tag. Defaults to 'en-US'. */
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Formats a numeric fiat amount using Intl.NumberFormat's currency style
 * (symbol + locale-correct grouping/decimals). Falls back to a plain
 * "<amount> <CODE>" string if the currency/locale combination is invalid
 * or Intl throws for any other reason — this must never throw itself,
 * since a formatting hiccup shouldn't be able to break a balance display.
 * Non-finite input (NaN, Infinity) renders as '--' rather than a
 * nonsensical number.
 */
export function formatCurrency(amount: number, options: FormatCurrencyOptions = {}): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  if (!Number.isFinite(amount)) return '--';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(maximumFractionDigits)} ${currency}`;
  }
}

/**
 * Formats a fiat amount for very small values (e.g. a network fee worth a
 * fraction of a cent) where the standard 2-decimal currency format would
 * round to "$0.00" and hide the real value. Falls back to formatCurrency's
 * normal 2-decimal display once the amount is large enough to show
 * meaningfully at that precision.
 */
export function formatCurrencyCompact(amount: number, options: FormatCurrencyOptions = {}): string {
  if (!Number.isFinite(amount)) return '--';
  if (amount !== 0 && Math.abs(amount) < 0.01) {
    return formatCurrency(amount, { ...options, minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
  return formatCurrency(amount, options);
}
