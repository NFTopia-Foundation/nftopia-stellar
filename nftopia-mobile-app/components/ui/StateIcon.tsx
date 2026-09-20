import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, emptyState } from '@/constants/theme';
import type { StateIconVariant } from './listState.types';

const GLYPHS: Record<StateIconVariant, string> = {
  empty: '✨',
  'filtered-empty': '🔍',
  error: '⚠️',
  offline: '📶',
};

const TINTS: Record<StateIconVariant, { background: string; foreground: string }> = {
  empty: {
    background: colors.surface,
    foreground: colors.textSecondary,
  },
  'filtered-empty': {
    background: colors.infoBackground,
    foreground: colors.info,
  },
  error: {
    background: colors.errorBackground,
    foreground: colors.error,
  },
  offline: {
    background: colors.warningBackground,
    foreground: colors.warning,
  },
};

export interface StateIconProps {
  variant: StateIconVariant;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}

const StateIcon: React.FC<StateIconProps> = ({
  variant,
  size = emptyState.iconSize,
  accessibilityLabel,
  testID,
}) => {
  const tint = TINTS[variant];

  return (
    <View
      style={[styles.container, { backgroundColor: tint.background }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Text
        style={[styles.glyph, { fontSize: size, color: tint.foreground }]}
        accessibilityLabel={accessibilityLabel}
      >
        {GLYPHS[variant]}
      </Text>
    </View>
  );
};

export default StateIcon;

const styles = StyleSheet.create({
  container: {
    width: emptyState.iconContainerSize,
    height: emptyState.iconContainerSize,
    borderRadius: emptyState.iconContainerRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: emptyState.iconMarginBottom,
  },
  glyph: {
    textAlign: 'center',
  },
});
