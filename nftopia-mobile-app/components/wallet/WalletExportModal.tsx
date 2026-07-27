import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

interface WalletExportModalProps {
  visible: boolean;
  publicKey: string;
  onRevealSecretKey: () => Promise<string | null>;
  onRevealMnemonic: () => Promise<string | null>;
  onClose: () => void;
}

export default function WalletExportModal({
  visible,
  publicKey,
  onRevealSecretKey,
  onRevealMnemonic,
  onClose,
}: WalletExportModalProps) {
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [copied, setCopied] = useState<'key' | 'mnemonic' | null>(null);

  const handleRevealSecret = async () => {
    if (secretKey) return;
    setLoadingSecret(true);
    const key = await onRevealSecretKey();
    setSecretKey(key);
    setLoadingSecret(false);
  };

  const handleRevealMnemonic = async () => {
    if (mnemonic) return;
    setLoadingMnemonic(true);
    const phrase = await onRevealMnemonic();
    setMnemonic(phrase);
    setLoadingMnemonic(false);
  };

  const handleCopy = async (text: string, type: 'key' | 'mnemonic') => {
    await Clipboard.setStringAsync(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = () => {
    setSecretKey(null);
    setMnemonic(null);
    setCopied(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Export Wallet</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.keyBox}>
              <Text style={styles.keyLabel}>Public Key</Text>
              <Text style={styles.keyValue} selectable>
                {publicKey}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Secret Key</Text>
              {secretKey ? (
                <View style={styles.revealedBox}>
                  <Text style={styles.revealedText} selectable>
                    {secretKey}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopy(secretKey, 'key')}
                  >
                    <Text style={styles.copyText}>
                      {copied === 'key' ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.revealButton}
                  onPress={handleRevealSecret}
                  disabled={loadingSecret}
                >
                  {loadingSecret ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={styles.revealButtonText}>Reveal Secret Key</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recovery Phrase</Text>
              {mnemonic ? (
                <View style={styles.revealedBox}>
                  <Text style={styles.revealedText} selectable>
                    {mnemonic}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopy(mnemonic, 'mnemonic')}
                  >
                    <Text style={styles.copyText}>
                      {copied === 'mnemonic' ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.revealButton}
                  onPress={handleRevealMnemonic}
                  disabled={loadingMnemonic}
                >
                  {loadingMnemonic ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={styles.revealButtonText}>Reveal Recovery Phrase</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                Never share your secret key or recovery phrase with anyone. These give full
                control over your wallet. Keep them stored securely offline.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeText: {
    fontSize: 16,
    color: colors.info,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  keyBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  keyLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  keyValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  revealButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  revealButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
  revealedBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  revealedText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  copyButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  copyText: {
    fontSize: 14,
    color: colors.info,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningBackground,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xl,
  },
  warningIcon: {
    fontSize: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warningText,
    lineHeight: 18,
  },
});
