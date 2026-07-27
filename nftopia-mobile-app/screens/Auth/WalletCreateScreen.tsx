import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { PasswordStrengthIndicator } from '@/screens/Auth/components';
import ValidationError from '@/screens/Auth/components/ValidationError';
import * as Clipboard from 'expo-clipboard';

type Props = NativeStackScreenProps<AuthStackParamList, 'WalletCreate'>;

type CreateStep = 'password' | 'mnemonic' | 'confirm';

export default function WalletCreateScreen({ navigation }: Props) {
  const [step, setStep] = useState<CreateStep>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { createNewWallet, isLoading, error, clearError } = useWalletConnect();

  const handleSetPassword = () => {
    setLocalError(null);
    if (!password) {
      setLocalError('Please enter a password');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    setStep('mnemonic');
  };

  const handleGenerateWallet = async () => {
    setLocalError(null);
    clearError();
    try {
      const wallet = await createNewWallet(password);
      if (wallet.mnemonic) {
        setGeneratedMnemonic(wallet.mnemonic);
      }
      setStep('confirm');
    } catch {
      // Error is set in store
    }
  };

  const handleCopyMnemonic = async () => {
    await Clipboard.setStringAsync(generatedMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    navigation.reset({ index: 0, routes: [{ name: 'EmailLogin' as any }] });
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'password' && (
          <>
            <Text style={styles.title}>Create Wallet</Text>
            <Text style={styles.subtitle}>
              Set a secure password to encrypt your wallet
            </Text>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <View style={styles.passwordField}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter password"
                      placeholderTextColor={colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={styles.toggleButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <PasswordStrengthIndicator password={password} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordRow}>
                  <View style={styles.passwordField}>
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.textTertiary}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={styles.toggleButton}
                      onPress={() => setShowConfirm(!showConfirm)}
                    >
                      <Text style={styles.toggleText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={[styles.warningBox, { backgroundColor: colors.warningBackground }]}>
                <Text style={styles.warningIcon}>🔒</Text>
                <Text style={[styles.warningText, { color: colors.warningText }]}>
                  Store your password securely. We cannot recover it if you lose it.
                </Text>
              </View>

              <ValidationError message={displayError} />
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleSetPassword}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>Generate Recovery Phrase</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                disabled={isLoading}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 'mnemonic' && (
          <>
            <Text style={styles.title}>Generate Recovery Phrase</Text>
            <Text style={styles.subtitle}>
              Press the button below to generate your wallet recovery phrase.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleGenerateWallet}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Generating...' : 'Generate Recovery Phrase'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'confirm' && (
          <>
            <Text style={styles.title}>Your Recovery Phrase</Text>
            <Text style={styles.subtitle}>
              Write down these words in order. Never share them with anyone.
            </Text>

            <View style={styles.mnemonicBox}>
              <View style={styles.wordGrid}>
                {generatedMnemonic.split(' ').map((word, index) => (
                  <View key={index} style={styles.wordChip}>
                    <Text style={styles.wordIndex}>{index + 1}.</Text>
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.copyMnemonicButton} onPress={handleCopyMnemonic}>
                <Text style={styles.copyMnemonicText}>
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.warningBox, { backgroundColor: colors.warningBackground }]}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={[styles.warningText, { color: colors.warningText }]}>
                If you lose your recovery phrase, you will lose access to your wallet.
                Store it safely offline.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.checkboxRow]}
              onPress={() => setBackedUp(!backedUp)}
            >
              <View style={[styles.checkbox, backedUp && styles.checkboxActive]}>
                {backedUp && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I have securely backed up my recovery phrase
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!backedUp) && styles.buttonDisabled,
              ]}
              onPress={handleFinish}
              disabled={!backedUp}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    flexGrow: 1,
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
  passwordRow: {
    // container for the password field
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  toggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.info,
  },
  mnemonicBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '30%',
    gap: spacing.xs,
  },
  wordIndex: {
    fontSize: 12,
    color: colors.textTertiary,
    width: 22,
    textAlign: 'right',
  },
  wordText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text,
    fontWeight: '500',
  },
  copyMnemonicButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  copyMnemonicText: {
    fontSize: 14,
    color: colors.info,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginVertical: spacing.sm,
  },
  warningIcon: {
    fontSize: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    paddingBottom: 32,
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
