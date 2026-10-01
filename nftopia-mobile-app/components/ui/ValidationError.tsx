import React, { useEffect } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { colors } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export interface ValidationErrorProps {
  message: string | null | undefined;
  testID?: string;
}

/**
 * Shared error-message pattern (#468, moved here from
 * screens/Auth/components/ValidationError.tsx) — used both standalone for
 * form-level errors and internally by TextField for field-level errors, so
 * every input in the app renders and announces errors the same way.
 */
export default function ValidationError({ message, testID }: ValidationErrorProps) {
  useEffect(() => {
    if (message) {
      // Android live regions don't reliably fire on iOS, so announce explicitly
      // to make sure VoiceOver/TalkBack both pick up the new error text.
      AccessibilityInfo.announceForAccessibility(message);
      haptics.error();
    }
  }, [message]);

  if (!message) return null;

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      importantForAccessibility="yes"
    >
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
    color: colors.error,
    fontWeight: '500',
  },
});
