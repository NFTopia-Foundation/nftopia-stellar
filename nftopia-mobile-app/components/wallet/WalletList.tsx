import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { Wallet } from '@/src/services/stellar/types';
import ConfirmationDialog from './ConfirmationDialog';

interface WalletListProps {
  wallets: Wallet[];
  activePublicKey: string | null;
  onSelect: (publicKey: string) => void;
  onRemove: (publicKey: string) => void;
  onExport: (publicKey: string) => void;
}

export default function WalletList({
  wallets,
  activePublicKey,
  onSelect,
  onRemove,
  onExport,
}: WalletListProps) {
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const walletToRemove = wallets.find((w) => w.publicKey === removingKey);

  const handleConfirmRemove = () => {
    if (removingKey) {
      onRemove(removingKey);
      setRemovingKey(null);
    }
  };

  const renderItem = ({ item }: { item: Wallet }) => {
    const isActive = item.publicKey === activePublicKey;

    return (
      <TouchableOpacity
        style={[styles.walletCard, isActive && styles.walletCardActive]}
        onPress={() => onSelect(item.publicKey)}
        activeOpacity={0.7}
      >
        <View style={styles.walletHeader}>
          <View style={[styles.dot, isActive && styles.dotActive]} />
          <Text style={styles.walletLabel} numberOfLines={1}>
            {item.publicKey.slice(0, 12)}...{item.publicKey.slice(-8)}
          </Text>
          {isActive && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>}
        </View>
        <View style={styles.walletActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onExport(item.publicKey)}
          >
            <Text style={styles.actionText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionRemove]}
            onPress={() => setRemovingKey(item.publicKey)}
          >
            <Text style={[styles.actionText, styles.actionRemoveText]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <FlatList
        data={wallets}
        keyExtractor={(item) => item.publicKey}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No wallets imported</Text>
          </View>
        }
      />
      <ConfirmationDialog
        visible={removingKey !== null}
        title="Remove Wallet"
        message={`Are you sure you want to remove this wallet? Make sure you have backed up the secret key or recovery phrase.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemovingKey(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  walletCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  walletCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
  },
  dotActive: {
    backgroundColor: colors.success,
  },
  walletLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text,
  },
  activeBadge: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },
  walletActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionRemove: {
    borderColor: colors.error,
    backgroundColor: colors.errorBackground,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionRemoveText: {
    color: colors.error,
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
  },
});
