import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { colors, spacing, borderRadius } from "@/constants/theme";
import type { Listing } from "@/types/index";
import NftCard from "./NftCard";
import SkeletonCard from "./SkeletonCard";

interface NftListProps {
  listings: Listing[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasNextPage: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onNftPress: (listing: Listing) => void;
}

const LOADING_SKELETON_COUNT = 6;

export default function NftList({
  listings,
  isLoading,
  isLoadingMore,
  isRefreshing,
  hasNextPage,
  error,
  onRefresh,
  onLoadMore,
  onRetry,
  onNftPress,
}: NftListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Listing }) => (
      <NftCard listing={item} onPress={onNftPress} />
    ),
    [onNftPress],
  );

  const keyExtractor = useCallback(
    (item: Listing, _index: number) => item.id,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasNextPage) {
      onLoadMore();
    }
  }, [isLoadingMore, hasNextPage, onLoadMore]);

  // Loading skeleton grid
  if (isLoading && listings.length === 0) {
    return (
      <FlatList
        data={Array.from({ length: LOADING_SKELETON_COUNT })}
        renderItem={() => <SkeletonCard />}
        keyExtractor={(_, index) => `skeleton-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  // Error state
  if (error && listings.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (!isLoading && listings.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🎨</Text>
        <Text style={styles.emptyTitle}>No NFTs Found</Text>
        <Text style={styles.emptyMessage}>
          The marketplace is empty. Be the first to list an NFT and start
          earning!
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      columnWrapperStyle={listings.length > 1 ? styles.columnWrapper : undefined}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.footerText}>Loading more NFTs...</Text>
          </View>
        ) : listings.length > 0 && !hasNextPage ? (
          <View style={styles.footerEnd}>
            <Text style={styles.footerEndText}>
              You&apos;ve reached the end
            </Text>
          </View>
        ) : null
      }
      // Show error banner at top if we have listings but errored on next page
      ListHeaderComponent={
        error && listings.length > 0 ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={onRetry}>
              <Text style={styles.errorBannerRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: spacing.sm,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerEnd: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  footerEndText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.error,
    marginRight: spacing.sm,
  },
  errorBannerRetry: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },
});
