import React from 'react';
import TextField, { TextFieldProps } from './TextField';

export interface AmountFieldProps
  extends Omit<TextFieldProps, 'keyboardType' | 'value' | 'onChangeText' | 'multiline'> {
  value: string;
  onChangeText: (text: string) => void;
  /** Max digits allowed after the decimal point. Defaults to 7 — Stellar's native asset precision. */
  maxDecimals?: number;
}

/**
 * Strips anything that isn't a digit or `.`, collapses to at most one
 * decimal point, and truncates the fractional part to `maxDecimals` — so
 * the field can never hold a value `Number()` would choke on or a fiat/XLM
 * amount with more precision than the chain (or the caller) supports.
 */
export function sanitizeAmountInput(text: string, maxDecimals = 7): string {
  let cleaned = text.replace(/[^0-9.]/g, '');

  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }

  if (maxDecimals <= 0) {
    return cleaned.replace('.', '');
  }

  const [intPart, decPart] = cleaned.split('.');
  return decPart === undefined ? intPart : `${intPart}.${decPart.slice(0, maxDecimals)}`;
}

/**
 * Numeric/decimal amount input (#468) — composes TextField, restricting
 * entry to a valid non-negative decimal so callers never need to validate
 * "is this a number" themselves (only "is this amount in range/affordable",
 * which stays business logic for the screen, e.g. SendScreen's minimum
 * reserve check).
 */
export default function AmountField({ value, onChangeText, maxDecimals = 7, ...rest }: AmountFieldProps) {
  return (
    <TextField
      {...rest}
      value={value}
      onChangeText={(text) => onChangeText(sanitizeAmountInput(text, maxDecimals))}
      keyboardType="decimal-pad"
    />
  );
}
