import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import TextField from '@/components/ui/TextField';

export interface FormInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  error?: string | null;
  testID?: string;
  multiline?: boolean;
  numberOfLines?: number;
  /** Label for the return key (e.g. "next", "done"). */
  returnKeyType?: TextInputProps['returnKeyType'];
  /** Called when the user presses the return key. Use for focus chaining. */
  onSubmitEditing?: () => void;
  /** Dismiss the keyboard after submit (defaults true for single-line). */
  blurOnSubmit?: boolean;
  /** Imperative handle to programmatically focus the input. */
  inputRef?: React.Ref<TextInput>;
}

/**
 * Auth-screen text input. Thin adapter over the shared `TextField` so email,
 * username and password fields all inherit the same styling and a11y wiring.
 */
export default function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
  error,
  testID,
  multiline = false,
  numberOfLines = 1,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  inputRef,
}: FormInputProps) {
  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      editable={editable}
      error={error}
      testID={testID}
      multiline={multiline}
      numberOfLines={numberOfLines}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      blurOnSubmit={blurOnSubmit}
      inputRef={inputRef}
    />
  );
}
