import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { colors, spacing, borderRadius } from '@/constants/theme';
import SecureInput from '@/components/wallet/SecureInput';
import MnemonicInput from '@/components/wallet/MnemonicInput';
import ValidationError from '@/screens/Auth/components/ValidationError';

type Props = NativeStackScreenProps<AuthStackParamList, 'WalletImport'>;

type ImportTab = 'secret' | 'mnemonic';

export default function WalletImportScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<ImportTab>('secret');
  const [secretKey, setSecretKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { importFromSecretKey, importFromMnemonic, isLoading, error, clearError } = useWalletConnect();

  const handleImport = async () => {
    setLocalError(null);
    clearError();

    if (!password) {
      setLocalError('Please enter a password');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    try {
      if (activeTab === 'secret') {
        if (!secretKey.trim()) {
          setLocalError('Please enter your secret key');
          return;
        }
        await importFromSecretKey(secretKey.trim(), password);
      } else {
        const phrase = mnemonic.trim();
        if (!phrase) {
          setLocalError('Please enter your recovery phrase');
          return;
        }
        const words = phrase.split(/\s+/);
        if (![12, 15, 18, 21, 24].includes(words.length)) {
          setLocalError('Recovery phrase must be 12, 15, 18, 21, or 24 words');
          return;
        }
        await importFromMnemonic(phrase, password);
      }
      navigation.reset({ index: 0, routes: [{ name: 'EmailLogin' as any }] });
    } catch {
      // Error is set in store
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Import Wallet</Text>
        <Text style={styles.subtitle}>
          Import your existing Stellar wallet
        </Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'secret' && styles.tabActive]}
            onPress={() => setActiveTab('secret')}
          >
            <Text style={[styles.tabText, activeTab === 'secret' && styles.tabTextActive]}>
              Secret Key
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mnemonic' && styles.tabActive]}
            onPress={() => setActiveTab('mnemonic')}
          >
            <Text style={[styles.tabText, activeTab === 'mnemonic' && styles.tabTextActive]}>
              Recovery Phrase
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {activeTab === 'secret' ? (
            <SecureInput
              label="Secret Key"
              placeholder="Enter your secret key (starts with S)"
              value={secretKey}
              onChangeText={setSecretKey}
              editable={!isLoading}
              testID="secret-key-input"
            />
          ) : (
            <MnemonicInput
              value={mnemonic}
              onChangeText={setMnemonic}
              editable={!isLoading}
              testID="mnemonic-input"
            />
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputWrapper}>
              <SecureInput
                label=""
                placeholder="Enter password to encrypt your wallet"
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
                testID="password-input"
              />
            </View>
          </View>

          <ValidationError message={displayError} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, (isLoading) && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? 'Importing...' : 'Import Wallet'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  passwordInputWrapper: {
    marginTop: -4,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: 32,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
