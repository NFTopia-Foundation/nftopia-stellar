import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useWalletStore } from '@/stores/walletStore';
import BalanceDisplay from '@/components/wallet/BalanceDisplay';

export default function HomeScreen() {
  const {
    activeWallet,
    activePublicKey,
    activeBalance,
    isLoading,
    error,
    fetchBalances,
  } = useWalletConnect();
  const network = useWalletStore((s) => s.network);

  const onRefresh = useCallback(() => {
    if (activePublicKey) {
      fetchBalances(activePublicKey);
    }
  }, [activePublicKey, fetchBalances]);

  useEffect(() => {
    if (activePublicKey) {
      fetchBalances(activePublicKey);
    }
  }, [activePublicKey]);

  if (!activeWallet) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Wallet Active</Text>
        <Text style={styles.emptySubtitle}>
          Import or create a wallet to get started
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Your Wallet</Text>
        <View style={styles.networkBadge}>
          <Text style={styles.networkBadgeText}>
            {network === 'testnet' ? 'Testnet' : 'Mainnet'}
          </Text>
        </View>
      </View>

      <BalanceDisplay
        xlmBalance={activeBalance?.xlm ?? null}
        tokenBalances={activeBalance?.tokens ?? []}
        isLoading={isLoading}
        error={error}
        onRefresh={onRefresh}
        publicKey={activePublicKey ?? undefined}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>📥</Text>
          <Text style={styles.actionLabel}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionLabel}>Swap</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 60,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  networkBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
