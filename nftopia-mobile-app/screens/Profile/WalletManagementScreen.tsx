import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/MainNavigator';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useBiometric } from '@/src/hooks/useBiometric';
import { BiometricConfirmationDialog } from '@/src/components/BiometricConfirmationDialog';
import WalletList from '@/components/wallet/WalletList';
import WalletExportModal from '@/components/wallet/WalletExportModal';

type Props = NativeStackScreenProps<MainStackParamList, 'WalletManagement'>;

export default function WalletManagementScreen({ navigation, route }: Props) {
  const {
    wallets,
    activePublicKey,
    setActiveWallet,
    removeWallet,
    revealSecretKey,
    revealMnemonic,
  } = useWalletConnect();

  const { requireBiometric, isAvailable } = useBiometric();

  const [exportingKey, setExportingKey] = useState<string | null>(null);

  // Handle auto-export when coming from backup reminder
  useEffect(() => {
    if (route.params?.autoExport && activePublicKey) {
      setExportingKey(activePublicKey);
      // Clear the param so it doesn't trigger again
      navigation.setParams({ autoExport: undefined });
    }
  }, [route.params?.autoExport, activePublicKey, navigation]);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: 'export' | 'reveal' | 'remove';
    publicKey: string;
  } | null>(null);
  const resolveRevealRef = useRef<((value: string | null) => void) | null>(null);
  const resolveMnemonicRef = useRef<((value: string | null) => void) | null>(null);

  const handleSelect = useCallback(
    (publicKey: string) => {
      setActiveWallet(publicKey);
    },
    [setActiveWallet],
  );

  const handleRemove = useCallback(
    (publicKey: string) => {
      // Require biometric for wallet removal
      if (isAvailable) {
        setPendingAction({ action: 'remove', publicKey });
        setShowBiometricPrompt(true);
      } else {
        // Fallback to confirmation dialog
        Alert.alert(
          'Remove Wallet',
          'Are you sure you want to remove this wallet?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => removeWallet(publicKey),
            },
          ]
        );
      }
    },
    [isAvailable, removeWallet],
  );

  const handleExport = useCallback(
    (publicKey: string) => {
      // Require biometric for wallet export
      if (isAvailable) {
        setPendingAction({ action: 'export', publicKey });
        setShowBiometricPrompt(true);
      } else {
        // Fallback to direct export (with confirmation)
        Alert.alert(
          'Export Wallet',
          'Exporting wallet keys is sensitive. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => setExportingKey(publicKey),
            },
          ]
        );
      }
    },
    [isAvailable],
  );

  const handleRevealSecretKey = useCallback(
    async (publicKey: string) => {
      // Require biometric for revealing secret key
      if (isAvailable) {
        return new Promise<string | null>((resolve) => {
          setPendingAction({ action: 'reveal', publicKey });
          setShowBiometricPrompt(true);
          resolveRevealRef.current = resolve;
        });
      } else {
        // Fallback: show confirmation
        return new Promise<string | null>((resolve) => {
          Alert.alert(
            'Reveal Secret Key',
            'This will reveal your wallet secret key. Continue?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              {
                text: 'Continue',
                onPress: async () => {
                  const key = await revealSecretKey(publicKey);
                  resolve(key);
                },
              },
            ]
          );
        });
      }
    },
    [isAvailable, revealSecretKey],
  );

  const handleRevealMnemonic = useCallback(
    async (publicKey: string) => {
      // Require biometric for revealing mnemonic
      if (isAvailable) {
        return new Promise<string | null>((resolve) => {
          setPendingAction({ action: 'reveal', publicKey });
          setShowBiometricPrompt(true);
          resolveMnemonicRef.current = resolve;
        });
      } else {
        // Fallback: show confirmation
        return new Promise<string | null>((resolve) => {
          Alert.alert(
            'Reveal Mnemonic',
            'This will reveal your wallet mnemonic phrase. Continue?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              {
                text: 'Continue',
                onPress: async () => {
                  const mnemonic = await revealMnemonic(publicKey);
                  resolve(mnemonic);
                },
              },
            ]
          );
        });
      }
    },
    [isAvailable, revealMnemonic],
  );

  const handleBiometricSuccess = useCallback(async () => {
    setShowBiometricPrompt(false);

    if (!pendingAction) return;

    const { action, publicKey } = pendingAction;
    setPendingAction(null);

    switch (action) {
      case 'export':
        setExportingKey(publicKey);
        break;
      case 'remove':
        Alert.alert(
          'Remove Wallet',
          'Are you sure you want to remove this wallet?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => removeWallet(publicKey),
            },
          ]
        );
        break;
      case 'reveal':
        // Handle reveal based on which callback was set
        if (resolveRevealRef.current) {
          const key = await revealSecretKey(publicKey);
          resolveRevealRef.current(key);
          resolveRevealRef.current = null;
        } else if (resolveMnemonicRef.current) {
          const mnemonic = await revealMnemonic(publicKey);
          resolveMnemonicRef.current(mnemonic);
          resolveMnemonicRef.current = null;
        }
        break;
    }
  }, [pendingAction, removeWallet, revealSecretKey, revealMnemonic]);

  const handleBiometricFailure = useCallback(() => {
    setShowBiometricPrompt(false);
    setPendingAction(null);
    // Resolve any pending promises with null
    if (resolveRevealRef.current) {
      resolveRevealRef.current(null);
      resolveRevealRef.current = null;
    }
    if (resolveMnemonicRef.current) {
      resolveMnemonicRef.current(null);
      resolveMnemonicRef.current = null;
    }
  }, []);

  const exportingWallet = wallets.find((w) => w.publicKey === exportingKey);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Transaction history"
          onPress={() => navigation.navigate('Transactions')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>History</Text>
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">
          Wallets
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {wallets.length === 0 ? (
        <View style={styles.empty} accessible accessibilityLabel="No wallets. Import or create a wallet to get started.">
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
        onRevealSecretKey={() => handleRevealSecretKey(exportingKey!)}
        onRevealMnemonic={() => handleRevealMnemonic(exportingKey!)}
        onClose={() => setExportingKey(null)}
      />

      <BiometricConfirmationDialog
        visible={showBiometricPrompt}
        action={pendingAction?.action === 'remove' ? 'SETTINGS_CHANGE' : 'EXPORT_WALLET'}
        title={
          pendingAction?.action === 'remove'
            ? 'Remove Wallet'
            : pendingAction?.action === 'reveal'
            ? 'Reveal Wallet Key'
            : 'Export Wallet'
        }
        message={
          pendingAction?.action === 'remove'
            ? 'Are you sure you want to remove this wallet? This action cannot be undone.'
            : pendingAction?.action === 'reveal'
            ? 'Authenticate to reveal your wallet key or mnemonic phrase.'
            : 'Authenticate to export your wallet keys.'
        }
        confirmLabel={
          pendingAction?.action === 'remove' ? 'Remove' : 'Authenticate'
        }
        destructive={pendingAction?.action === 'remove'}
        onConfirm={handleBiometricSuccess}
        onCancel={handleBiometricFailure}
        onSuccess={handleBiometricSuccess}
        onFailure={handleBiometricFailure}
        requireFallback={true}
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