import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { SecretKeyInput } from './components/SecretKeyInput';

type ImportMethod = 'secretKey' | 'mnemonic';

interface WalletImportScreenProps {
  onComplete?: () => void;
}

export const WalletImportScreen: React.FC<WalletImportScreenProps> = ({
  onComplete,
}) => {
  const [method, setMethod] = useState<ImportMethod>('secretKey');
  const [secretKey, setSecretKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setWalletInStore = useAuthStore(
    (state) => (state as { setWallet: (w: Wallet | null) => void }).setWallet,
  );

  const formattedMnemonic = mnemonic
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ');

  const mnemonicWordCount = formattedMnemonic.trim()
    ? formattedMnemonic.trim().split(/\s+/).length
    : 0;

  const isMnemonicValid = stellarWalletService.isValidMnemonic(formattedMnemonic);
  const isSecretKeyValid = stellarWalletService.isValidSecretKey(secretKey);

  const canSubmit =
    method === 'secretKey' ? isSecretKeyValid : isMnemonicValid;

  const handleImport = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      let wallet: Wallet;
      if (method === 'secretKey') {
        wallet = await stellarWalletService.importFromSecretKey(
          secretKey.trim(),
          password || undefined,
        );
      } else {
        wallet = await stellarWalletService.importFromMnemonic(
          formattedMnemonic,
          password || undefined,
        );
      }
      setWalletInStore(wallet);
      onComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to import wallet';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Import Wallet</Text>
        <Text style={styles.subheading}>
          Use your existing secret key or recovery phrase to access your wallet.
        </Text>

        {/* Method toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, method === 'secretKey' && styles.tabActive]}
            onPress={() => {
              setMethod('secretKey');
              setError(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.tabText, method === 'secretKey' && styles.tabTextActive]}
            >
              Secret Key
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, method === 'mnemonic' && styles.tabActive]}
            onPress={() => {
              setMethod('mnemonic');
              setError(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.tabText, method === 'mnemonic' && styles.tabTextActive]}
            >
              Recovery Phrase
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inputs */}
        {method === 'secretKey' ? (
          <SecretKeyInput
            value={secretKey}
            onChange={(v) => {
              setSecretKey(v);
              setError(null);
            }}
            error={error ?? undefined}
          />
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recovery Phrase</Text>
            <TextInput
              style={[
                styles.mnemonicInput,
                mnemonic.length > 0 && isMnemonicValid && styles.inputValid,
                mnemonic.length > 0 && !isMnemonicValid && styles.inputInvalid,
              ]}
              value={mnemonic}
              onChangeText={(v) => {
                setMnemonic(v);
                setError(null);
              }}
              placeholder="Enter your 12 or 24 word recovery phrase..."
              placeholderTextColor="#9CA3AF"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Recovery phrase input"
            />
            <Text style={styles.wordCount}>
              {mnemonicWordCount} / {mnemonicWordCount <= 12 ? 12 : 24} words
              {mnemonic.length > 0 && !isMnemonicValid
                ? ' — enter 12 or 24 words'
                : ''}
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}

        {/* Password */}
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
              placeholder="Password used when creating your wallet"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Wallet decryption password"
            />
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.toggleText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.importButton,
            (!canSubmit || loading) && styles.importButtonDisabled,
          ]}
          onPress={handleImport}
          disabled={!canSubmit || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.importText}>Import and Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 40,
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  section: {
    gap: 6,
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
  mnemonicInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputValid: {
    borderColor: '#10B981',
  },
  inputInvalid: {
    borderColor: '#EF4444',
  },
  wordCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
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
  importButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  importButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  importText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
