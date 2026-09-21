import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import TextField from '@/components/ui/TextField';
import { colors, spacing, typography } from '@/constants/theme';

interface MnemonicInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  editable?: boolean;
  testID?: string;
}

export const VALID_WORD_COUNTS = [12, 15, 18, 21, 24];
export const MAX_WORDS = 24;

/**
 * Recovery-phrase entry. Both the paste-a-phrase text area and the
 * word-by-word grid are composed from the shared `TextField` (the grid uses the
 * compact size), so error, focus and accessibility behaviour match the rest of
 * the form library.
 */
export default function MnemonicInput({
  value,
  onChangeText,
  error,
  editable = true,
  testID,
}: MnemonicInputProps) {
  const [mode, setMode] = useState<'paste' | 'words'>('paste');
  const [wordInputs, setWordInputs] = useState<string[]>(Array(12).fill(''));
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
          <TouchableOpacity
            onPress={switchToPaste}
            accessibilityRole="button"
            accessibilityLabel="Paste recovery phrase instead"
          >
            <Text style={styles.switchLink}>Paste instead</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.wordGrid}>
          {wordInputs.slice(0, MAX_WORDS).map((word, index) => (
            <View key={index} style={styles.wordInputWrapper}>
              <Text style={styles.wordIndex} accessibilityElementsHidden importantForAccessibility="no">
                {index + 1}.
              </Text>
              <View style={styles.wordField}>
                <TextField
                  size="compact"
                  containerStyle={styles.wordTextField}
                  placeholder={`Word ${index + 1}`}
                  value={word}
                  onChangeText={(t) => handleWordChange(index, t)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={editable}
                  returnKeyType={index < MAX_WORDS - 1 ? 'next' : 'done'}
                  onSubmitEditing={() => handleWordSubmit(index)}
                  inputRef={(ref) => {
                    wordRefs.current[index] = ref;
                  }}
                  accessibilityLabel={`Recovery phrase word ${index + 1}`}
                  accessibilityHint={`Word ${index + 1} of the recovery phrase`}
                  testID={testID ? `${testID}-word-${index}` : undefined}
                />
              </View>
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
        <TouchableOpacity
          onPress={switchToWords}
          accessibilityRole="button"
          accessibilityLabel="Enter recovery phrase word-by-word"
        >
          <Text style={styles.switchLink}>Enter word-by-word</Text>
        </TouchableOpacity>
      </View>
      {/* Paste mode is a multiline field: pasting a full phrase (12-24 words)
          works in one gesture and Return inserts a newline instead of blurring,
          so multi-word entry stays clean with the keyboard open. */}
      <TextField
        multiline
        numberOfLines={4}
        containerStyle={styles.pasteField}
        inputStyle={styles.pasteInput}
        placeholder="Paste your 12, 15, 18, 21, or 24 word phrase"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        blurOnSubmit={false}
        testID={testID}
        accessibilityLabel="Recovery phrase"
        accessibilityHint="Paste your 12, 15, 18, 21, or 24 word recovery phrase"
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
  pasteField: {
    marginBottom: 0,
  },
  pasteInput: {
    minHeight: 100,
    fontFamily: typography.mono.fontFamily,
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
  wordField: {
    flex: 1,
  },
  wordTextField: {
    marginBottom: 0,
  },
  wordIndex: {
    fontSize: 12,
    color: colors.textTertiary,
    width: 24,
    textAlign: 'right',
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
