import type { DisplayCurrency } from './stores/types';

/**
 * Placeholder static XLM→USD rate. There is no live price-feed integration
 * in this codebase yet — this exists so the USD display preference is
 * visibly different from XLM (per #660's acceptance criteria) rather than
 * silently reformatting the same number. Replace with a real price oracle
 * when one is wired up.
 */
export const PLACEHOLDER_XLM_USD_RATE = 0.12;

function toNumber(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  return Number.isNaN(num) ? 0 : num;
}

/** Converts an amount already denominated in XLM into the given display currency. */
export function convertFromXlm(
  amountXlm: number | string | null | undefined,
  currency: DisplayCurrency
): number {
  const xlm = toNumber(amountXlm);
  return currency === 'USD' ? xlm * PLACEHOLDER_XLM_USD_RATE : xlm;
}

/**
 * Formats an amount already denominated in XLM for display in the given
 * currency — e.g. `formatCurrencyAmount(24.5, 'XLM')` -> `"24.5000 XLM"`,
 * `formatCurrencyAmount(24.5, 'USD')` -> `"$2.94"`.
 */
export function formatCurrencyAmount(
  amountXlm: number | string | null | undefined,
  currency: DisplayCurrency
): string {
  const converted = convertFromXlm(amountXlm, currency);

  if (currency === 'USD') {
    return `$${converted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} XLM`;
}

export const DISPLAY_CURRENCY_OPTIONS: { value: DisplayCurrency; label: string }[] = [
  { value: 'XLM', label: 'XLM (Stellar Lumens)' },
  { value: 'USD', label: 'USD (US Dollar)' },
];
