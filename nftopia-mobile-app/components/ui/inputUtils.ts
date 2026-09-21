// Pure helpers for the shared form-input library.
//
// These live in a React-Native-free module on purpose: screens, components and
// unit tests can all import the amount sanitising / select-navigation logic
// without pulling in native modules.

export interface AmountInputOptions {
  /** Maximum number of digits after the decimal point. Defaults to 7. */
  decimals?: number;
  /** Whether a decimal separator is allowed. Defaults to true. */
  allowDecimal?: boolean;
  /** Maximum integer digits; 0 means unlimited. Defaults to 0. */
  maxIntegerDigits?: number;
}

const stripLeadingZeros = (digits: string): string => digits.replace(/^0+(?=\d)/, '');

const clampIntegerPart = (digits: string, maxIntegerDigits: number): string => {
  const normalised = stripLeadingZeros(digits);
  if (maxIntegerDigits > 0 && normalised.length > maxIntegerDigits) {
    return normalised.slice(0, maxIntegerDigits);
  }
  return normalised;
};

/**
 * Normalise raw text from an amount input into a well-formed decimal string.
 *
 * - strips everything that is not a digit or a single decimal separator
 * - accepts either `.` or `,` as the decimal separator (commas are normalised)
 * - limits the number of fraction digits and integer digits when configured
 * - keeps partial input (e.g. `"12."`) while the user is still typing
 */
export function sanitizeAmountInput(raw: string, options: AmountInputOptions = {}): string {
  const { decimals = 7, allowDecimal = true, maxIntegerDigits = 0 } = options;
  if (!raw) return '';

  if (!allowDecimal) {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    return clampIntegerPart(digitsOnly, maxIntegerDigits);
  }

  const normalised = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dotIndex = normalised.indexOf('.');
  const hasDecimalPoint = dotIndex !== -1;

  const integerPart = dotIndex === -1 ? normalised : normalised.slice(0, dotIndex);
  const fractionPart = dotIndex === -1 ? '' : normalised.slice(dotIndex + 1).replace(/\./g, '');

  let integer = clampIntegerPart(integerPart, maxIntegerDigits);
  let fraction = decimals > 0 ? fractionPart.slice(0, decimals) : '';

  if (hasDecimalPoint && integer === '') {
    integer = '0';
  }

  if (!hasDecimalPoint || decimals <= 0) {
    return integer;
  }

  return `${integer}.${fraction}`;
}

/** Whether `value` is a complete, well-formed amount for the given options. */
export function isValidAmount(value: string, options: AmountInputOptions = {}): boolean {
  const { decimals = 7, allowDecimal = true, maxIntegerDigits = 0 } = options;
  if (!value) return false;

  if (!allowDecimal) {
    if (!/^\d+$/.test(value)) return false;
  } else {
    const integerPattern = decimals > 0 ? `(?:0|[1-9]\\d*)(?:\\.\\d{1,${decimals}})?` : `(?:0|[1-9]\\d*)`;
    if (!new RegExp(`^${integerPattern}$`).test(value)) return false;
  }

  if (maxIntegerDigits > 0) {
    const integer = value.split('.')[0];
    if (integer.length > maxIntegerDigits) return false;
  }

  return true;
}

export type SelectNavigateKey =
  | 'ArrowDown'
  | 'ArrowUp'
  | 'Home'
  | 'End'
  | 'Enter'
  | ' '
  | 'Escape'
  | 'Tab'
  | string;

/**
 * Compute the next highlighted option index for keyboard navigation of a
 * `SelectField`. Returns `-1` when there are no options.
 */
export function getNextHighlightIndex(
  currentIndex: number,
  optionCount: number,
  key: SelectNavigateKey,
  loop = true
): number {
  if (optionCount <= 0) return -1;

  switch (key) {
    case 'ArrowDown':
    case 'Down':
      if (currentIndex < 0) return 0;
      return loop
        ? (currentIndex + 1) % optionCount
        : Math.min(currentIndex + 1, optionCount - 1);
    case 'ArrowUp':
    case 'Up':
      if (currentIndex < 0) return optionCount - 1;
      return loop
        ? (currentIndex - 1 + optionCount) % optionCount
        : Math.max(currentIndex - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return optionCount - 1;
    default:
      return currentIndex;
  }
}
