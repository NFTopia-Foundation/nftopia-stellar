import React, { useEffect } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, StyleProp, TextStyle } from 'react-native';
import { colors } from '@/constants/theme';

export interface ValidationErrorProps {
  message: string | null;
  testID?: string;
  /** Optional style overrides merged on top of the shared error text style. */
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Shared inline validation message used by every input variant.
 *
 * It is intentionally small: announce the message for screen readers
 * (Android live regions don't reliably fire on iOS, so an explicit
 * announcement keeps VoiceOver/TalkBack in sync) and render the message with
 * the canonical error typography.
 */
export default function ValidationError({ message, testID, textStyle }: ValidationErrorProps) {
  useEffect(() => {
    if (message) {
      AccessibilityInfo.announceForAccessibility(message);
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
      <Text style={[styles.errorText, textStyle]}>{message}</Text>
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
