import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ValidationErrorProps {
  message: string | null;
  testID?: string;
}

export default function ValidationError({ message, testID }: ValidationErrorProps) {
  if (!message) return null;

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
});
