import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { haptics } from '@/lib/haptics';
import { colors, shadows } from '@/constants/theme';

export type FavoriteKind = 'nft' | 'collection';

export interface FavoriteButtonProps {
  id: string;
  kind?: FavoriteKind;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  onToggle?: (nowFavorite: boolean) => void;
  testID?: string;
}

const SIZES = {
  sm: { button: 28, icon: 16 },
  md: { button: 36, icon: 20 },
  lg: { button: 44, icon: 24 },
};

/**
 * Heart toggle for favoriting NFTs or collections.
 *
 * The store updates synchronously (optimistic UI), so tapping the heart
 * gives instant feedback. Favorites are persisted to async storage and
 * survive app restarts. Items are de-duplicated by id in the store, and the
 * button reflects the persisted state on every render.
 */
export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  id,
  kind = 'nft',
  size = 'md',
  showCount = false,
  onToggle,
  testID,
}) => {
  const isFavorite = useFavoritesStore((s) =>
    kind === 'nft' ? s.favorites.includes(id) : s.favoriteCollections.includes(id)
  );
  const toggle = useFavoritesStore((s) =>
    kind === 'nft' ? s.toggleFavorite : s.toggleFavoriteCollection
  );
  const favoriteCount = useFavoritesStore((s) =>
    kind === 'nft' ? s.favorites.length : s.favoriteCollections.length
  );

  const dims = SIZES[size];

  const handlePress = useCallback(() => {
    const next = !isFavorite;
    haptics.toggle();
    toggle(id);
    onToggle?.(next);
  }, [id, isFavorite, toggle, onToggle]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { width: dims.button, height: dims.button, borderRadius: dims.button / 2 },
        isFavorite && styles.buttonActive,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      accessibilityState={{ selected: isFavorite }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID}
    >
      <Text style={[styles.heart, { fontSize: dims.icon }, isFavorite && styles.heartActive]}>
        {isFavorite ? '♥' : '♡'}
      </Text>
      {showCount && favoriteCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{favoriteCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default FavoriteButton;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...shadows.sm,
  },
  buttonActive: {
    backgroundColor: colors.primary,
  },
  heart: {
    color: colors.textSecondary,
  },
  heartActive: {
    color: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
