import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { TokenBalance } from '@/src/services/stellar/balance.service';
import { useAssetPrices } from '@/hooks/useAssetPrices';
import { PriceQuote } from '@/src/services/stellar/priceService';
import { convertToFiat, formatCryptoAmount, formatCurrency } from '@/src/utils/formatCurrency';

interface BalanceDisplayProps {
  xlmBalance: string | null;
  tokenBalances: TokenBalance[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  publicKey?: string;
  /** Toggle the fiat-equivalent line. Defaults to true. */
  showFiat?: boolean;
}

export default function BalanceDisplay({
  xlmBalance,
  tokenBalances,
  isLoading,
  error,
  onRefresh,
  publicKey,
  showFiat = true,
}: BalanceDisplayProps) {
  const assetCodes = React.useMemo(
    () => ['XLM', ...tokenBalances.map((token) => token.asset_code)],
    [tokenBalances]
  );
  const { quotes, hasStalePrice } = useAssetPrices(assetCodes);

  const renderFiat = (assetCode: string, rawBalance: string | null) => {
    if (!showFiat || rawBalance === null) return null;
    const quote: PriceQuote | null | undefined = quotes[assetCode.toUpperCase()];
    const fiatValue = convertToFiat(rawBalance, quote?.rate ?? null);
    if (fiatValue === null) return null;

    return (
      <Text style={styles.fiatValue} testID={`balance-fiat-${assetCode}`}>
        ≈ {formatCurrency(fiatValue, { currency: quote?.currency })}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Balances</Text>
        <View style={styles.headerRight}>
          {hasStalePrice ? (
            <View
              style={styles.staleBadge}
              accessibilityRole="text"
              accessibilityLabel="Prices may be out of date"
              testID="balance-stale-indicator"
            >
              <Text style={styles.staleText}>Prices may be outdated</Text>
            </View>
          ) : null}
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh} disabled={isLoading}>
              <Text style={styles.refreshText}>{isLoading ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {publicKey ? (
        <Text style={styles.publicKey} numberOfLines={1}>
          {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading && !xlmBalance ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>XLM</Text>
            <View style={styles.balanceValues}>
              <Text style={styles.balanceValue}>{formatCryptoAmount(xlmBalance)}</Text>
              {renderFiat('XLM', xlmBalance)}
            </View>
          </View>

          {tokenBalances.map((token, index) => (
            <View key={`${token.asset_code}-${token.asset_issuer}-${index}`} style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>{token.asset_code}</Text>
              <View style={styles.balanceValues}>
                <Text style={styles.balanceValue}>{formatCryptoAmount(token.balance)}</Text>
                {renderFiat(token.asset_code, token.balance)}
              </View>
            </View>
          ))}

          {(!tokenBalances || tokenBalances.length === 0) && xlmBalance !== null && (
            <Text style={styles.noTokens}>No token balances</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  refreshText: {
    fontSize: 14,
    color: colors.info,
    fontWeight: '500',
  },
  staleBadge: {
    backgroundColor: colors.warningBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  staleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warningText,
  },
  publicKey: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  balanceLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  balanceValues: {
    alignItems: 'flex-end',
  },
  balanceValue: {
    fontSize: 16,
    color: colors.text,
    fontFamily: 'monospace',
  },
  fiatValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noTokens: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
});
