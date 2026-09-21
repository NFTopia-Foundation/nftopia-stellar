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
import ValidationError from '@/components/ui/ValidationError';
import {
  borderRadius,
  colors,
  inputTokens,
  resolveInputBackgroundColor,
  resolveInputBorderColor,
  spacing,
  typography,
} from '@/constants/theme';

export type TextFieldSize = 'default' | 'compact';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Visible field label. Omit for label-less fields (e.g. mnemonic slots). */
  label?: string;
  /** Helper copy rendered under the field when there is no error. */
  helperText?: string;
  /** Validation message. When set the field renders in its error state. */
  error?: string | null;
  testID?: string;
  /** Imperative handle to focus the underlying TextInput. */
  inputRef?: React.Ref<TextInput>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Style override for the TextInput itself, not the surrounding frame. */
  inputStyle?: StyleProp<TextStyle>;
  /** Rendered before the text input inside the bordered frame. */
  leftAccessory?: React.ReactNode;
  /** Rendered after the text input inside the bordered frame. */
  rightAccessory?: React.ReactNode;
  size?: TextFieldSize;
}

/**
 * `TextField` is the single base input for the app.
 *
 * It owns label, error, helper text, focus/blur styling and accessibility
 * wiring. All other input variants (`FormInput`, `SecureInput`, `AmountField`,
 * `SelectField`, mnemonic word slots) compose it so the visual contract and
 * screen-reader behaviour stay identical everywhere.
 */
export default function TextField({
  label,
  helperText,
  error,
  testID,
  inputRef,
  containerStyle,
  inputStyle,
  leftAccessory,
  rightAccessory,
  size = 'default',
  multiline = false,
  editable = true,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  ...rest
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isCompact = size === 'compact';
  const hasError = Boolean(error);

  const borderColor = resolveInputBorderColor({ focused: isFocused, error: hasError });
  const backgroundColor = resolveInputBackgroundColor({
    focused: isFocused,
    error: hasError,
    disabled: !editable,
  });

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  const labelId = testID ? `${testID}-label` : undefined;

  return (
    <View style={[styles.container, isCompact && styles.containerCompact, containerStyle]}>
      {label ? (
        <Text
          style={[styles.label, isCompact && styles.labelCompact]}
          nativeID={labelId}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          isCompact && styles.inputWrapperCompact,
          multiline && styles.inputWrapperMultiline,
          { borderColor, backgroundColor },
        ]}
      >
        {leftAccessory}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            isCompact && styles.inputCompact,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          placeholderTextColor={inputTokens.placeholder}
          editable={editable}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          testID={testID}
          accessible
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint ?? error ?? undefined}
          accessibilityState={{ disabled: !editable, ...accessibilityState }}
          {...rest}
        />
        {rightAccessory}
      </View>

      {hasError ? (
        <ValidationError
          message={error ?? null}
          testID={testID ? `${testID}-error` : undefined}
        />
      ) : helperText ? (
        <Text
          style={[styles.helperText, isCompact && styles.helperTextCompact]}
          testID={testID ? `${testID}-helper` : undefined}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: 4,
  },
  containerCompact: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: inputTokens.label,
  },
  labelCompact: {
    ...typography.caption,
    color: inputTokens.label,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  inputWrapperCompact: {
    minHeight: 40,
    borderRadius: borderRadius.sm,
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  inputCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: typography.mono.fontFamily,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  helperText: {
    ...typography.caption,
    color: inputTokens.helper,
  },
  helperTextCompact: {
    fontSize: 11,
  },
});
