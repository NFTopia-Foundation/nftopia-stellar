import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';
import type { FeeEstimate, FeeTierName } from '@/src/services/stellar/wallet.service';

const TIER_LABELS: Record<FeeTierName, string> = {
  low: 'Low',
  medium: 'Normal',
  high: 'Priority',
};

export interface TransactionFeeSummaryProps {
  /** null while the estimate is still loading. */
  estimate: FeeEstimate | null;
  loading: boolean;
  selectedTier: FeeTierName;
  onSelectTier: (tier: FeeTierName) => void;
  useCustomFee: boolean;
  onToggleCustomFee: (value: boolean) => void;
  customFeeStroops: string;
  onCustomFeeChange: (value: string) => void;
  customFeeError?: string;
  /**
   * Pluggable fiat conversion (#471) — deliberately not a built-in price
   * fetch: this app has no price service yet (see wallet.service.ts's
   * own #471 notes), so fabricating a hardcoded/fake rate here would show
   * a misleading number. Pass a formatter once a real price service
   * exists; omitted, the fiat line simply doesn't render.
   */
  fiatFormatter?: (xlm: string) => string | undefined;
  /** Set when checkMinimumReserve fails — rendered as a blocking warning; pair with ConfirmationDialog's confirmDisabled. */
  reserveWarning?: string;
  testID?: string;
}

export function TransactionFeeSummary({
  estimate,
  loading,
  selectedTier,
  onSelectTier,
  useCustomFee,
  onToggleCustomFee,
  customFeeStroops,
  onCustomFeeChange,
  customFeeError,
  fiatFormatter,
  reserveWarning,
  testID,
}: TransactionFeeSummaryProps) {
  if (loading || !estimate) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.loadingText}>Estimating network fee…</Text>
        </View>
      </View>
    );
  }

  const fiat = fiatFormatter?.(estimate.totalFeeXlm);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Network Fee</Text>
        <View style={styles.totalValueWrap}>
          <Text style={styles.totalValue}>{estimate.totalFeeXlm} XLM</Text>
          {fiat ? <Text style={styles.totalFiat}>≈ {fiat}</Text> : null}
        </View>
      </View>

      {estimate.isSurge ? (
        <Text style={styles.badgeSurge}>⚡ Network congestion — fees are higher than usual</Text>
      ) : null}
      {estimate.degraded ? (
        <Text style={styles.badgeDegraded}>
          Live network fee data is unavailable — showing an estimated fee.
        </Text>
      ) : null}

      {estimate.operationCount > 1 ? (
        <View style={styles.breakdown} testID={testID ? `${testID}-breakdown` : undefined}>
          {estimate.breakdown.map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <Text style={styles.breakdownValue}>{item.feeXlm} XLM</Text>
            </View>
          ))}
        </View>
      ) : null}

      {reserveWarning ? (
        <View style={styles.reserveWarning} accessibilityRole="alert">
          <Text style={styles.reserveWarningText}>{reserveWarning}</Text>
        </View>
      ) : null}

      {!useCustomFee ? (
        <View style={styles.tierRow}>
          {(Object.keys(TIER_LABELS) as FeeTierName[]).map((tierName) => (
            <TouchableOpacity
              key={tierName}
              style={[styles.tierButton, selectedTier === tierName && styles.tierButtonSelected]}
              onPress={() => onSelectTier(tierName)}
              accessibilityRole="button"
              accessibilityLabel={`${TIER_LABELS[tierName]} fee`}
              accessibilityState={{ selected: selectedTier === tierName }}
            >
              <Text
                style={[
                  styles.tierButtonText,
                  selectedTier === tierName && styles.tierButtonTextSelected,
                ]}
              >
                {TIER_LABELS[tierName]}
              </Text>
              <Text
                style={[
                  styles.tierButtonFee,
                  selectedTier === tierName && styles.tierButtonTextSelected,
                ]}
              >
                {estimate.tiers[tierName].feePerOperationStroops} stroops/op
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => onToggleCustomFee(!useCustomFee)}
        accessibilityRole="button"
        accessibilityLabel={useCustomFee ? 'Use a recommended fee instead' : 'Set a custom fee'}
      >
        <Text style={styles.advancedToggleText}>
          {useCustomFee ? '‹ Use recommended fee' : 'Advanced: set custom fee ›'}
        </Text>
      </TouchableOpacity>

      {useCustomFee ? (
        <View style={styles.customFeeRow}>
          <TextInput
            style={[styles.customFeeInput, customFeeError ? styles.customFeeInputError : null]}
            value={customFeeStroops}
            onChangeText={onCustomFeeChange}
            keyboardType="number-pad"
            placeholder="Fee per operation, in stroops"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Custom fee per operation, in stroops"
            testID={testID ? `${testID}-custom-fee-input` : undefined}
          />
          {customFeeError ? <Text style={styles.customFeeError}>{customFeeError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export default TransactionFeeSummary;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValueWrap: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalFiat: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  badgeSurge: {
    fontSize: 12,
    color: colors.warningText,
    backgroundColor: colors.warningBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  badgeDegraded: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  breakdown: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 12,
    color: colors.text,
    fontFamily: 'monospace',
  },
  reserveWarning: {
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  reserveWarningText: {
    fontSize: 12,
    color: colors.errorText ?? colors.error,
    fontWeight: '600',
  },
  tierRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tierButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  tierButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tierButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  tierButtonFee: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tierButtonTextSelected: {
    color: colors.textInverse,
  },
  advancedToggle: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  advancedToggleText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  customFeeRow: {
    marginTop: spacing.xs,
  },
  customFeeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  customFeeInputError: {
    borderColor: colors.error,
  },
  customFeeError: {
    fontSize: 11,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
