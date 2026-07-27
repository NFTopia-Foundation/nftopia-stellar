import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { colors, spacing, borderRadius, shadows } from "@/constants/theme";
import type { Listing } from "@/types/index";

interface NftCardProps {
  listing: Listing;
  onPress: (listing: Listing) => void;
}

export default function NftCard({ listing, onPress }: NftCardProps) {
  const [imageError, setImageError] = useState(false);

  const nft = listing.nft;
  const seller = listing.seller;
  const price = listing.price;
  const currency = listing.currency || "XLM";

  const handlePress = useCallback(() => {
    onPress(listing);
  }, [listing, onPress]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityLabel={`NFT: ${nft?.name ?? "Untitled"}, Price: ${price} ${currency}`}
      accessibilityRole="button"
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {nft?.image && !imageError ? (
          <Image
            source={{ uri: nft.image }}
            style={styles.image}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.fallbackText}>🎨</Text>
            <Text style={styles.fallbackLabel}>No Image</Text>
          </View>
        )}

        {/* Price Badge */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>
            {price} {currency}
          </Text>
        </View>

        {/* Collection Badge */}
        {nft?.collectionName ? (
          <View style={styles.collectionBadge}>
            <Text style={styles.collectionText} numberOfLines={1}>
              {nft.collectionName}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info Section */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {nft?.name ?? "Untitled NFT"}
        </Text>

        <View style={styles.metaRow}>
          {/* Creator */}
          <View style={styles.creatorRow}>
            {seller?.avatar ? (
              <Image
                source={{ uri: seller.avatar }}
                style={styles.avatar}
                defaultSource={undefined}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(seller?.username ?? "U").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.creatorName} numberOfLines={1}>
              {seller?.username ?? seller?.walletAddress?.slice(0, 8) ?? "Unknown"}
            </Text>
          </View>

          {/* Token ID */}
          {nft?.tokenId ? (
            <Text style={styles.tokenId}>#{nft.tokenId}</Text>
          ) : null}
        </View>

        {/* Status Badge */}
        {listing.status === "ACTIVE" ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Listed</Text>
          </View>
        ) : listing.status === "SOLD" ? (
          <View style={styles.soldBadge}>
            <Text style={styles.soldBadgeText}>Sold</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  imageContainer: {
    position: "relative",
    aspectRatio: 1,
    backgroundColor: "#f0f0f0",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8e8e8",
  },
  fallbackText: {
    fontSize: 40,
  },
  fallbackLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  priceBadge: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  priceText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  collectionBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    maxWidth: "60%",
  },
  collectionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  infoContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  creatorName: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  tokenId: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: "monospace",
  },
  activeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e6f7ee",
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1a7f4b",
  },
  soldBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  soldBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.error,
  },
});
