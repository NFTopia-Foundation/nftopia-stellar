import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, fieldColors } from '@/constants/theme';
import ValidationError from './ValidationError';

/**
 * Form input component library (#468).
 *
 * TextField is the shared base every text-style input in the app should
 * compose instead of re-implementing label/error/focus styling:
 *
 * - TextField    — this component. Free-form text, used directly by new
 *                   screens that don't need a specialized variant.
 * - FormInput    — screens/Auth/components/FormInput.tsx. Auth-flow text
 *                   inputs (email, name, etc).
 * - SecureInput  — components/wallet/SecureInput.tsx. Adds a show/hide
 *                   toggle for secrets (private keys).
 * - MnemonicInput — components/wallet/MnemonicInput.tsx. Recovery-phrase
 *                   entry, paste or word-by-word.
 * - AmountField  — components/ui/AmountField.tsx. Restricts input to a
 *                   valid numeric/decimal amount.
 * - SelectField  — components/ui/SelectField.tsx. Dropdown/select, backed
 *                   by BottomSheet (#469).
 *
 * See docs/form-inputs.md for full usage examples of each.
 */

export interface TextFieldProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  error?: string | null;
  /** Shown below the input when there's no error. Hidden while an error is present. */
  helperText?: string;
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  inputRef?: React.Ref<TextInput>;
  /** Rendered inside the input's bordered wrapper, after the TextInput (e.g. a show/hide toggle). */
  rightAccessory?: React.ReactNode;
  /** Rendered directly below the wrapper, above helper/error text (e.g. a running word/character count). Always shown, independent of error state. */
  statusText?: React.ReactNode;
  /** Defaults to `label` when omitted. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export default function TextField({
  label,
  error,
  helperText,
  testID,
  containerStyle,
  inputStyle,
  inputRef,
  rightAccessory,
  statusText,
  accessibilityLabel,
  accessibilityHint,
  editable = true,
  multiline = false,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label} nativeID={testID ? `${testID}-label` : undefined}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.wrapper,
          isFocused && styles.wrapperFocused,
          error ? styles.wrapperError : undefined,
          !editable && styles.wrapperDisabled,
          multiline && styles.wrapperMultiline,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          placeholderTextColor={colors.textTertiary}
          editable={editable}
          multiline={multiline}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          testID={testID}
          accessible
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint ?? (error ?? undefined)}
          accessibilityState={{ disabled: !editable }}
          {...inputProps}
        />
        {rightAccessory}
      </View>
      {statusText}
      {error ? (
        <ValidationError message={error} testID={testID ? `${testID}-error` : undefined} />
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: fieldColors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: fieldColors.border,
  },
  wrapperFocused: {
    borderColor: fieldColors.borderFocused,
    backgroundColor: fieldColors.backgroundFocused,
  },
  wrapperError: {
    borderColor: fieldColors.borderError,
    backgroundColor: fieldColors.backgroundError,
  },
  wrapperDisabled: {
    opacity: 0.6,
    backgroundColor: fieldColors.backgroundDisabled,
  },
  wrapperMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    minHeight: 52,
    color: colors.text,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    paddingTop: 12,
    minHeight: 100,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
