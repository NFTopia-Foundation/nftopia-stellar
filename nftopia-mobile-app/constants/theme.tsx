import { ThemeColors } from '@/src/theme/types';
import { lightColors, darkColors } from '@/src/theme/colors';

// Export base spacing, borderRadius, etc. (theme-agnostic)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: 'bold' as const },
  h2: { fontSize: 24, fontWeight: 'bold' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16 },
  bodySmall: { fontSize: 14 },
  caption: { fontSize: 12 },
  mono: { fontSize: 14, fontFamily: 'monospace' as const },
};

// Shared spacing/typography tokens for empty, error, and offline states.
export const emptyState = {
  iconContainerSize: 88,
  iconContainerRadius: 44,
  iconSize: 40,
  maxContentWidth: 320,
  contentPaddingVertical: spacing.xxl,
  contentPaddingHorizontal: spacing.xl,
  iconMarginBottom: spacing.md,
  titleMarginBottom: spacing.xs,
  messageMarginBottom: spacing.lg,
  actionGap: spacing.sm,
  actionPaddingVertical: spacing.md,
  actionPaddingHorizontal: spacing.lg,
  actionRadius: borderRadius.md,
  titleFontSize: typography.h3.fontSize,
  titleFontWeight: '700' as const,
  messageFontSize: typography.bodySmall.fontSize,
  messageLineHeight: 20,
};

export const shadows = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
};

// Export color getters for backward compatibility
export const getColors = (isDark: boolean): ThemeColors => {
  return isDark ? darkColors : lightColors;
};

// Legacy colors export (for gradual migration)
// These will be deprecated in favor of useTheme()
export const colors = lightColors;

// Re-export types
export type { ThemeColors };

// Helper to create themed styles
export const createThemedStyles = <T extends Record<string, any>>(
  stylesFn: (colors: ThemeColors) => T
): ((isDark: boolean) => T) => {
  return (isDark: boolean): T => {
    const themeColors = getColors(isDark);
    return stylesFn(themeColors);
  };
};

// Helper to get shadow with theme color
export const getShadow = (isDark: boolean, level: 'sm' | 'md' = 'md') => {
  const shadowColor = isDark ? '#000000' : '#000000';
  const baseShadow = shadows[level];
  return {
    ...baseShadow,
    shadowColor,
  };
};

// Helper to get typography with theme colors
export const getTypography = (isDark: boolean) => {
  const themeColors = getColors(isDark);
  return {
    h1: { ...typography.h1, color: themeColors.text },
    h2: { ...typography.h2, color: themeColors.text },
    h3: { ...typography.h3, color: themeColors.text },
    body: { ...typography.body, color: themeColors.text },
    bodySmall: { ...typography.bodySmall, color: themeColors.textSecondary },
    caption: { ...typography.caption, color: themeColors.textTertiary },
    mono: { ...typography.mono, color: themeColors.text },
  };
};

// Helper to get all themed values
export const getThemedValues = (isDark: boolean) => {
  const themeColors = getColors(isDark);
  return {
    colors: themeColors,
    spacing,
    borderRadius,
    typography: getTypography(isDark),
    shadows: {
      sm: getShadow(isDark, 'sm'),
      md: getShadow(isDark, 'md'),
    },
  };
};