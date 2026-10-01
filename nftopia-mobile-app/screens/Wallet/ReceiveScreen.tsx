import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, SafeAreaView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useWalletStore } from '@/stores/walletStore';
import { useToast } from '@/src/hooks/useToast';
import { analyticsService } from '@/src/analytics/analytics.service';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';
import { errorLogger } from '@/src/errors/logger';
import { getAcceptedAssetCodes, getWalletLabel, getNetworkBadgeLabel } from '@/src/utils/receiveViewModel';

interface ReceiveScreenProps {
  navigation?: any;
}

const QR_SIZE = 220;

export function ReceiveScreen({ navigation }: ReceiveScreenProps) {
  const wallets = useWalletStore((s) => s.wallets);
  const activePublicKey = useWalletStore((s) => s.activePublicKey);
  const network = useWalletStore((s) => s.network);
  const balances = useWalletStore((s) => s.balances);
  const { showSuccess, showError } = useToast();

  const activeIndex = wallets.findIndex((w) => w.publicKey === activePublicKey);
  const activeBalance = activePublicKey ? balances[activePublicKey] ?? null : null;

  const acceptedAssets = useMemo(() => getAcceptedAssetCodes(activeBalance), [activeBalance]);
  const walletLabel = getWalletLabel(wallets.length, activeIndex);
  const networkLabel = getNetworkBadgeLabel(network);
  const isMainnet = network === 'mainnet';

  const handleClose = () => navigation?.goBack?.();

  const handleCopy = async () => {
    if (!activePublicKey) return;
    try {
      await Clipboard.setStringAsync(activePublicKey);
      showSuccess('Address copied to clipboard');
      analyticsService.track(ANALYTICS_EVENTS.WALLET_RECEIVE, { action: 'copy' });
    } catch (error) {
      errorLogger.log(error as Error, 'ReceiveScreen.handleCopy');
      showError('Could not copy the address — try selecting it manually');
    }
  };

  const handleShare = async () => {
    if (!activePublicKey) return;
    try {
      const result = await Share.share({
        title: 'My NFTopia wallet address',
        message: `My NFTopia wallet address (${networkLabel}):\n${activePublicKey}`,
      });
      if (result.action === Share.sharedAction) {
        analyticsService.track(ANALYTICS_EVENTS.WALLET_RECEIVE, { action: 'share' });
      }
    } catch (error) {
      errorLogger.log(error as Error, 'ReceiveScreen.handleShare');
      showError('Could not open the share sheet');
    }
  };

  if (!activePublicKey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No active wallet</Text>
          <Text style={styles.emptyText}>Create or import a wallet to receive funds.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Receive</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View
          style={[styles.networkBadge, isMainnet ? styles.networkBadgeMainnet : styles.networkBadgeTestnet]}
          accessibilityLabel={`Network: ${networkLabel}`}
        >
          <View
            style={[styles.networkDot, { backgroundColor: isMainnet ? colors.mainnet : colors.testnet }]}
          />
          <Text style={styles.networkBadgeText}>{networkLabel}</Text>
        </View>

        <Text style={styles.walletLabel}>{walletLabel}</Text>

        <View style={styles.qrCard}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`QR code for your wallet address, ${activePublicKey}`}
          >
            <QRCode value={activePublicKey} size={QR_SIZE} />
          </View>
        </View>

        <View style={styles.addressBox}>
          <Text
            style={styles.addressText}
            selectable
            accessibilityLabel={`Wallet address: ${activePublicKey}`}
          >
            {activePublicKey}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel="Copy address"
          >
            <Text style={styles.actionButtonText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share address"
          >
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.assetsBox}>
          <Text style={styles.assetsTitle}>This account accepts</Text>
          <Text style={styles.assetsText}>{acceptedAssets.join(', ')}</Text>
          <Text style={styles.assetsHint}>
            Only send assets this account has a trustline for. Sending an unsupported asset can
            result in permanent loss of funds.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default ReceiveScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.lg,
  },
  closeText: { fontSize: 20, color: colors.textSecondary, padding: spacing.xs },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSpacer: { width: 28 },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  networkBadgeTestnet: {
    backgroundColor: colors.warningBackground,
    borderColor: colors.testnet,
  },
  networkBadgeMainnet: {
    backgroundColor: colors.successBackground,
    borderColor: colors.mainnet,
  },
  networkDot: { width: 8, height: 8, borderRadius: 4 },
  networkBadgeText: { fontSize: 13, fontWeight: '700', color: colors.text },
  walletLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
    marginBottom: spacing.lg,
  },
  addressBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: colors.text,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  assetsBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  assetsTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  assetsText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  assetsHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
