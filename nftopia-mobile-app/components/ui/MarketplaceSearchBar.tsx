import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius } from '@/constants/theme';

const DEBOUNCE_MS = 400;

export interface MarketplaceSearchBarProps {
  onSearchChange: (query: string) => void;
  onSubmit?: (query: string) => void;
  testID?: string;
}

/**
 * Local, scoped search input for the marketplace grid. Deliberately does not
 * reuse the global `useSearchStore` (that store drives the separate,
 * cross-entity Search screen against a different API client) — keeping this
 * self-contained avoids entangling the two search experiences.
 */
const MarketplaceSearchBar: React.FC<MarketplaceSearchBarProps> = ({ onSearchChange, onSubmit, testID }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChangeText = (text: string) => {
    setValue(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(text.trim());
    }, DEBOUNCE_MS);
  };

  const handleSubmitEditing = () => {
    const q = value.trim();
    if (q && typeof onSubmit === 'function') {
      onSubmit(q);
    }
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue('');
    onSearchChange('');
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmitEditing}
        placeholder={t('marketplace.searchPlaceholder')}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        testID={testID ? `${testID}-input` : undefined}
      />
      {value.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          testID={testID ? `${testID}-clear` : undefined}
        >
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default MarketplaceSearchBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  clearText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
