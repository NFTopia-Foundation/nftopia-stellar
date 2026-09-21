import React from 'react';
import { StyleSheet, Text, StyleProp, TextStyle } from 'react-native';
import TextField, { TextFieldProps } from '@/components/ui/TextField';
import { sanitizeAmountInput, AmountInputOptions } from '@/components/ui/inputUtils';
import { colors } from '@/constants/theme';

export interface AmountFieldProps
  extends Omit<TextFieldProps, 'onChangeText' | 'value' | 'keyboardType'>,
    AmountInputOptions {
  value: string;
  /** Receives the sanitised amount string, ready to be stored as-is. */
  onChangeText: (value: string) => void;
  /** Currency ticker rendered inside the field (e.g. "XLM", "USDC"). */
  currency?: string;
}

/**
 * Numeric/decimal input for token amounts.
 *
 * Guarantees every `onChangeText` callback receives a sanitised value: only
 * digits and at most one decimal separator, with the configured fraction and
 * integer length limits. Invalid characters are dropped rather than showing an
 * error, so the field can never hold an amount that is impossible to submit.
 */
export default function AmountField({
  value,
  onChangeText,
  currency,
  decimals = 7,
  allowDecimal = true,
  maxIntegerDigits = 0,
  inputStyle,
  rightAccessory,
  ...textFieldProps
}: AmountFieldProps) {
  const handleChangeText = (raw: string) => {
    const sanitized = sanitizeAmountInput(raw, { decimals, allowDecimal, maxIntegerDigits });
    onChangeText(sanitized);
  };

  return (
    <TextField
      {...textFieldProps}
      value={value}
      onChangeText={handleChangeText}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      inputStyle={[amountStyle, inputStyle]}
      rightAccessory={
        rightAccessory ?? (currency ? <AmountSuffix currency={currency} /> : undefined)
      }
    />
  );
}

function AmountSuffix({ currency }: { currency: string }) {
  return (
    <Text
      style={styles.suffix}
      accessible
      accessibilityLabel={`Amount in ${currency}`}
      testID={`amount-suffix-${currency}`}
    >
      {currency}
    </Text>
  );
}

const amountStyle: StyleProp<TextStyle> = {
  fontVariant: ['tabular-nums'],
};

const styles = StyleSheet.create({
  suffix: {
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
