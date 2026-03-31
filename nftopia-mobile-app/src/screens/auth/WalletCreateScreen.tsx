import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { stellarWalletService } from '../../services/stellar/wallet.service';
import { Wallet } from '../../services/stellar/types';
import { useAuthStore } from '../../stores/authStore';
import { MnemonicConfirmation } from './components/MnemonicConfirmation';
import { MnemonicDisplay } from './components/MnemonicDisplay';

interface WalletCreateScreenProps {
  onComplete?: () => void;
}

export const WalletCreateScreen: React.FC<WalletCreateScreenProps> = ({
  onComplete,
}) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [mnemonic, setMnemonic] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setWalletInStore = useAuthStore(
    (state) => (state as { setWallet: (w: Wallet | null) => void }).setWallet,
  );

  const generateWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await stellarWalletService.createWallet(
        password || undefined,
      );
      setWallet(result.wallet);
      setMnemonic(result.mnemonic);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate wallet';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    generateWallet();
  }, []);

  const handleCopyAddress = async () => {
    if (!wallet) return;
    try {
      const Clipboard = await import('expo-clipboard').catch(() => null);
      if (Clipboard) {
        await Clipboard.setStringAsync(wallet.publicKey);
        Alert.alert('Copied', 'Public address copied to clipboard.');
      }
    } catch {
      Alert.alert('Public Address', wallet.publicKey);
    }
  };

  const handleContinue = async () => {
    if (!wallet || !confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      setWalletInStore(wallet);
      onComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save wallet';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Generating your wallet...</Text>
      </View>
    );
  }

  if (error && !wallet) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>Something went wrong</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={generateWallet}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Your New Wallet</Text>
      <Text style={styles.subheading}>
        Store your recovery phrase in a safe place. It&apos;s the only way to
        recover your wallet.
      </Text>

      {/* Public Address */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Public Address</Text>
        <View style={styles.addressRow}>
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
            {wallet?.publicKey}
          </Text>
          <TouchableOpacity
            style={styles.copyAddressButton}
            onPress={handleCopyAddress}
          >
            <Text style={styles.copyAddressText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mnemonic */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Recovery Phrase</Text>
        {mnemonic ? (
          <MnemonicDisplay mnemonic={mnemonic} />
        ) : null}
      </View>

      {/* Password (optional) */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Encryption Password{' '}
          <Text style={styles.optional}>(optional)</Text>
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Protect your wallet with a password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Wallet encryption password"
          />
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowPassword((v) => !v)}
          >
            <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirmation */}
      <MnemonicConfirmation confirmed={confirmed} onChange={setConfirmed} />

      {error ? <Text style={styles.errorInline}>{error}</Text> : null}

      {/* CTA */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          (!confirmed || submitting) && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!confirmed || submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.continueText}>Continue to Create Profile</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subheading: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  optional: {
    fontWeight: '400',
    color: '#9CA3AF',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyAddressButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#6366F1',
    borderRadius: 6,
  },
  copyAddressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 12,
  },
  toggleButton: {
    paddingLeft: 8,
  },
  toggleText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  errorHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  errorBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorInline: {
    fontSize: 13,
    color: '#EF4444',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
