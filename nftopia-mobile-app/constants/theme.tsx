export const colors = {
  primary: '#000',
  primaryDark: '#333',
  background: '#ffffff',
  surface: '#f8f9fa',
  surfaceElevated: '#ffffff',
  border: '#e9ecef',
  borderFocused: '#007AFF',
  text: '#1a1a1a',
  textSecondary: '#666',
  textTertiary: '#999',
  textInverse: '#fff',
  error: '#FF3B30',
  errorBackground: '#FFF5F5',
  warning: '#FF9500',
  warningBackground: '#fff3cd',
  warningText: '#856404',
  success: '#34C759',
  info: '#007AFF',
  infoBackground: '#e7f3ff',
  infoText: '#084298',
  testnet: '#FF9500',
  mainnet: '#34C759',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: 'bold' as const, color: colors.text },
  h2: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  bodySmall: { fontSize: 14, color: colors.textSecondary },
  caption: { fontSize: 12, color: colors.textTertiary },
  mono: { fontSize: 14, fontFamily: 'monospace' as const, color: colors.text },
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
};
