import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, TextInput, TextInputProps } from 'react-native';
import TextField from '@/components/ui/TextField';
import { colors, spacing, typography } from '@/constants/theme';

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

/**
 * Secure text entry (secret key / password) built on `TextField`.
 *
 * The show/hide affordance is supplied as the base field's right accessory so
 * the border, focus ring and error styling stay centrally managed.
 */
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
      inputRef={inputRef}
      inputStyle={styles.input}
      rightAccessory={
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsSecure((previous) => !previous)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isSecure ? 'Show value' : 'Hide value'}
          accessibilityState={{ expanded: !isSecure }}
        >
          <Text style={styles.toggleText}>{isSecure ? 'Show' : 'Hide'}</Text>
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: typography.mono.fontFamily,
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
});
