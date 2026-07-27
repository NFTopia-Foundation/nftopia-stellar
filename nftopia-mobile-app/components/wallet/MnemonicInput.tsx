import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface MnemonicInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  editable?: boolean;
  testID?: string;
}

const VALID_WORD_COUNTS = [12, 15, 18, 21, 24];

export default function MnemonicInput({
  value,
  onChangeText,
  error,
  editable = true,
  testID,
}: MnemonicInputProps) {
  const [mode, setMode] = useState<'paste' | 'words'>('paste');
  const [wordInputs, setWordInputs] = useState<string[]>(Array(12).fill(''));

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isValidCount = VALID_WORD_COUNTS.includes(wordCount);

  const handleWordChange = (index: number, text: string) => {
    const updated = [...wordInputs];
    updated[index] = text;
    setWordInputs(updated);
    const phrase = updated.filter((w) => w.trim()).join(' ');
    onChangeText(phrase);
  };

  const switchToWords = () => {
    setMode('words');
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 12) {
      setWordInputs(words.slice(0, 24));
    } else {
      setWordInputs(Array(24).fill(''));
    }
  };

  const switchToPaste = () => {
    setMode('paste');
    const words = wordInputs.filter((w) => w.trim());
    if (words.length > 0) {
      onChangeText(words.join(' '));
    }
  };

  if (mode === 'words') {
    return (
      <View style={styles.container}>
        <View style={styles.modeRow}>
          <Text style={styles.label}>Recovery Phrase</Text>
          <TouchableOpacity onPress={switchToPaste}>
            <Text style={styles.switchLink}>Paste instead</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.wordGrid}>
          {wordInputs.slice(0, 24).map((word, index) => (
            <View key={index} style={styles.wordInputWrapper}>
              <Text style={styles.wordIndex}>{index + 1}.</Text>
              <TextInput
                style={styles.wordInput}
                placeholder={`Word ${index + 1}`}
                placeholderTextColor={colors.textTertiary}
                value={word}
                onChangeText={(t) => handleWordChange(index, t)}
                autoCapitalize="none"
                autoCorrect={false}
                editable={editable}
                testID={testID ? `${testID}-word-${index}` : undefined}
              />
            </View>
          ))}
        </View>
        <Text style={styles.wordCount}>
          {wordInputs.filter((w) => w.trim()).length} / {VALID_WORD_COUNTS.join(', ')} words
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <Text style={styles.label}>Recovery Phrase</Text>
        <TouchableOpacity onPress={switchToWords}>
          <Text style={styles.switchLink}>Enter word-by-word</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.textArea, error ? styles.inputError : undefined]}
        placeholder="Paste your 12, 15, 18, 21, or 24 word phrase"
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={4}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        testID={testID}
      />
      {value.trim() ? (
        <Text style={[styles.wordCount, !isValidCount && styles.wordCountInvalid]}>
          {wordCount} word{wordCount !== 1 ? 's' : ''}
          {!isValidCount && ' — expected 12, 15, 18, 21, or 24'}
        </Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  switchLink: {
    fontSize: 14,
    color: colors.info,
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    fontSize: 16,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBackground,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '47%',
    gap: spacing.xs,
  },
  wordIndex: {
    fontSize: 12,
    color: colors.textTertiary,
    width: 24,
    textAlign: 'right',
  },
  wordInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  wordCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  wordCountInvalid: {
    color: colors.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
  },
});
