import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, fieldColors } from '@/constants/theme';
import TextField from '@/components/ui/TextField';
import ValidationError from '@/components/ui/ValidationError';

interface MnemonicInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  editable?: boolean;
  testID?: string;
}

const VALID_WORD_COUNTS = [12, 15, 18, 21, 24];
const MAX_WORDS = 24;

/** Recovery-phrase input, paste or word-by-word (#468) — the paste mode composes the shared TextField base; the word grid uses TextField's centralized fieldColors for its own compact per-word styling. */
export default function MnemonicInput({
  value,
  onChangeText,
  error,
  editable = true,
  testID,
}: MnemonicInputProps) {
  const [mode, setMode] = useState<'paste' | 'words'>('paste');
  const [wordInputs, setWordInputs] = useState<string[]>(Array(12).fill(''));
  const [focusedWordIndex, setFocusedWordIndex] = useState<number | null>(null);
  const wordRefs = useRef<Array<TextInput | null>>([]);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isValidCount = VALID_WORD_COUNTS.includes(wordCount);

  const handleWordChange = (index: number, text: string) => {
    const updated = [...wordInputs];
    updated[index] = text;
    setWordInputs(updated);
    const phrase = updated.filter((w) => w.trim()).join(' ');
    onChangeText(phrase);
  };

  // Pressing Return / Next on a word advances focus to the next word slot, so
  // multi-word entry is fluid while the keyboard stays open.
  const handleWordSubmit = (index: number) => {
    const next = index + 1;
    if (next < MAX_WORDS) {
      wordRefs.current[next]?.focus();
    }
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
          <TouchableOpacity onPress={switchToPaste} accessibilityRole="button">
            <Text style={styles.switchLink}>Paste instead</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.wordGrid}>
          {wordInputs.slice(0, MAX_WORDS).map((word, index) => (
            <View key={index} style={styles.wordInputWrapper}>
              <Text style={styles.wordIndex}>{index + 1}.</Text>
              <TextInput
                ref={(ref) => {
                  wordRefs.current[index] = ref;
                }}
                style={[
                  styles.wordInput,
                  focusedWordIndex === index && styles.wordInputFocused,
                  !editable && styles.wordInputDisabled,
                ]}
                placeholder={`Word ${index + 1}`}
                placeholderTextColor={colors.textTertiary}
                value={word}
                onChangeText={(t) => handleWordChange(index, t)}
                autoCapitalize="none"
                autoCorrect={false}
                editable={editable}
                returnKeyType={index < MAX_WORDS - 1 ? 'next' : 'done'}
                onSubmitEditing={() => handleWordSubmit(index)}
                onFocus={() => setFocusedWordIndex(index)}
                onBlur={() => setFocusedWordIndex((current) => (current === index ? null : current))}
                testID={testID ? `${testID}-word-${index}` : undefined}
                accessible
                accessibilityLabel={`Word ${index + 1}`}
                accessibilityState={{ disabled: !editable }}
              />
            </View>
          ))}
        </View>
        <Text style={styles.wordCount}>
          {wordInputs.filter((w) => w.trim()).length} / {VALID_WORD_COUNTS.join(', ')} words
        </Text>
        <ValidationError message={error} testID={testID ? `${testID}-error` : undefined} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <Text style={styles.label}>Recovery Phrase</Text>
        <TouchableOpacity onPress={switchToWords} accessibilityRole="button">
          <Text style={styles.switchLink}>Enter word-by-word</Text>
        </TouchableOpacity>
      </View>
      {/* Paste mode is a multiline field: pasting a full phrase (12-24 words)
          works in one gesture and Return inserts a newline instead of blurring,
          so multi-word entry stays clean with the keyboard open. */}
      <TextField
        placeholder="Paste your 12, 15, 18, 21, or 24 word phrase"
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={4}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        blurOnSubmit={false}
        error={error}
        testID={testID}
        accessibilityLabel="Recovery phrase"
        inputStyle={styles.textAreaInput}
        statusText={
          value.trim() ? (
            <Text style={[styles.wordCount, !isValidCount && styles.wordCountInvalid]}>
              {wordCount} word{wordCount !== 1 ? 's' : ''}
              {!isValidCount && ' — expected 12, 15, 18, 21, or 24'}
            </Text>
          ) : null
        }
      />
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
  textAreaInput: {
    fontFamily: 'monospace',
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
    backgroundColor: fieldColors.background,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: fieldColors.border,
    color: colors.text,
  },
  wordInputFocused: {
    borderColor: fieldColors.borderFocused,
    backgroundColor: fieldColors.backgroundFocused,
  },
  wordInputDisabled: {
    opacity: 0.6,
    backgroundColor: fieldColors.backgroundDisabled,
  },
  wordCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  wordCountInvalid: {
    color: colors.error,
  },
});
