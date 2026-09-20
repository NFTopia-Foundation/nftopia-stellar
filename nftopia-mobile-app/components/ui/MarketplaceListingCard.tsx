import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { OptimizedImage } from '@/src/components/OptimizedImage';
import { FavoriteButton } from '@/components/ui/FavoriteButton';
import { ShareButton } from '@/components/ui/ShareButton';
import type { MarketplaceListingCard as MarketplaceListingCardVM } from '@/src/utils/marketplaceViewModels';

const CARD_IMAGE_HEIGHT = 160;

export interface MarketplaceListingCardProps {
  item: MarketplaceListingCardVM;
  onPress: (item: MarketplaceListingCardVM) => void;
  onImageLoad?: (item: MarketplaceListingCardVM) => void;
  onImageError?: (item: MarketplaceListingCardVM, error: Error) => void;
  testID?: string;
}

const MarketplaceListingCard: React.FC<MarketplaceListingCardProps> = ({
  item,
  onPress,
  onImageLoad,
  onImageError,
  testID,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      testID={testID}
    >
      <View>
        <OptimizedImage
          source={item.imageUrl}
          width="100%"
          height={CARD_IMAGE_HEIGHT}
          resizeMode="cover"
          cacheKey={`marketplace-listing-${item.id}`}
          showSkeleton
          lazyLoad
          quality="auto"
          onLoad={() => onImageLoad?.(item)}
          onError={(err) => onImageError?.(item, err)}
        />
        <View style={styles.overlayActions}>
          <ShareButton
            type="nft"
            id={item.nftId}
            title={item.name}
            message={`Check out ${item.name} by ${item.creatorName} on NFTopia!`}
            variant="icon"
            size="sm"
            testID={`listing-share-${item.id}`}
          />
          <FavoriteButton
            id={item.nftId}
            kind="nft"
            size="sm"
            testID={`listing-favorite-${item.id}`}
          />
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.creator} numberOfLines={1}>
          {item.creatorName}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
          {item.priceLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default MarketplaceListingCard;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  content: {
    padding: spacing.sm,
    gap: 2,
  },
  overlayActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  creator: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
});
