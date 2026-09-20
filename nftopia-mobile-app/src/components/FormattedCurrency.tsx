import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface FormattedCurrencyProps extends TextProps {
  amount: number | string;
  currency?: string;
  fallback?: string;
}

export function FormattedCurrency({
  amount,
  currency = 'USD',
  fallback = '0.00',
  style,
  ...props
}: FormattedCurrencyProps) {
  const { i18n } = useTranslation();

  const formatted = formatCurrency(amount, {
    currency,
    locale: i18n.language,
    fallback,
  });

  return <Text style={style} {...props}>{formatted}</Text>;
}
