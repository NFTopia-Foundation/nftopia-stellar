import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';

interface MnemonicDisplayProps {
  mnemonic: string;
}

export const MnemonicDisplay: React.FC<MnemonicDisplayProps> = ({ mnemonic }) => {
  const [copied, setCopied] = useState(false);
  const words = mnemonic.trim().split(/\s+/);

  const handleCopy = async () => {
    try {
      // expo-clipboard is the recommended approach; fall back to alert on web
      const Clipboard = await import('expo-clipboard').catch(() => null);
      if (Clipboard) {
        await Clipboard.setStringAsync(mnemonic);
      } else {
        Alert.alert('Recovery Phrase', mnemonic);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Copy failed', 'Please write down your recovery phrase manually.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordCell}>
            <Text style={styles.wordIndex}>{index + 1}</Text>
            <Text style={styles.word}>{word}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.copyButton, copied && styles.copyButtonActive]}
        onPress={handleCopy}
        activeOpacity={0.8}
      >
        <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy Phrase'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  wordCell: {
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  wordIndex: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    minWidth: 16,
  },
  word: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  copyButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyButtonActive: {
    backgroundColor: '#4F46E5',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
