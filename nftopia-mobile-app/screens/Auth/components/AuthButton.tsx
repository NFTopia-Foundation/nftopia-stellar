import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, GestureResponderEvent } from 'react-native';

interface AuthButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export default function AuthButton({
  title,
  onPress,
  style,
  textStyle,
  icon,
  variant = 'primary',
  disabled = false,
}: AuthButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' ? styles.primary : styles.secondary,
        style,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      {icon && <>{icon}</>}
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginVertical: 4,
  },
  primary: {
    backgroundColor: '#000',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
