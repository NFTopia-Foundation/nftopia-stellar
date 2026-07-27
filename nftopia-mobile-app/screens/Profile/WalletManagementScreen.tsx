import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/MainNavigator';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import WalletList from '@/components/wallet/WalletList';
import WalletExportModal from '@/components/wallet/WalletExportModal';

type Props = NativeStackScreenProps<MainStackParamList, 'WalletManagement'>;

export default function WalletManagementScreen({ navigation }: Props) {
  const {
    wallets,
    activePublicKey,
    setActiveWallet,
    removeWallet,
    revealSecretKey,
    revealMnemonic,
  } = useWalletConnect();

  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const handleSelect = useCallback(
    (publicKey: string) => {
      setActiveWallet(publicKey);
    },
    [setActiveWallet],
  );

  const handleRemove = useCallback(
    (publicKey: string) => {
      removeWallet(publicKey);
    },
    [removeWallet],
  );

  const handleExport = useCallback(
    (publicKey: string) => {
      setExportingKey(publicKey);
    },
    [],
  );

  const exportingWallet = wallets.find((w) => w.publicKey === exportingKey);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wallets</Text>
        <View style={styles.headerSpacer} />
      </View>

      {wallets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Wallets</Text>
          <Text style={styles.emptySubtitle}>
            Import or create a wallet to get started
          </Text>
        </View>
      ) : (
        <WalletList
          wallets={wallets}
          activePublicKey={activePublicKey}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onExport={handleExport}
        />
      )}

      <WalletExportModal
        visible={exportingKey !== null}
        publicKey={exportingWallet?.publicKey ?? ''}
        onRevealSecretKey={async () => {
          if (!exportingKey) return null;
          return await revealSecretKey(exportingKey);
        }}
        onRevealMnemonic={async () => {
          if (!exportingKey) return null;
          return await revealMnemonic(exportingKey);
        }}
        onClose={() => setExportingKey(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backText: {
    fontSize: 16,
    color: colors.info,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
