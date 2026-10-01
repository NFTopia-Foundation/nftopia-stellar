import React, { useState } from 'react';
import { Text, TextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import TextField from '@/components/ui/TextField';

interface SecureInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  editable?: boolean;
  testID?: string;
  /** Label for the return key. Defaults to "done" (single-line secret key). */
  returnKeyType?: TextInputProps['returnKeyType'];
  /** Called when the user presses the return key. */
  onSubmitEditing?: () => void;
  /** Imperative handle to focus this input from a parent screen. */
  inputRef?: React.Ref<TextInput>;
}

/** Secret-key input with a show/hide toggle (#468) — composes the shared TextField base. */
export default function SecureInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  editable = true,
  testID,
  returnKeyType = 'done',
  onSubmitEditing,
  inputRef,
}: SecureInputProps) {
  const [isSecure, setIsSecure] = useState(true);

  return (
    <TextField
      inputRef={inputRef}
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={isSecure}
      autoCapitalize="none"
      autoCorrect={false}
      editable={editable}
      error={error}
      testID={testID}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      inputStyle={styles.input}
      accessibilityHint={isSecure ? 'Secret hidden. Double tap Show to reveal it.' : undefined}
      rightAccessory={
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsSecure(!isSecure)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isSecure ? 'Show secret' : 'Hide secret'}
        >
          <Text style={styles.toggleText}>{isSecure ? 'Show' : 'Hide'}</Text>
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: 'monospace',
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
});
