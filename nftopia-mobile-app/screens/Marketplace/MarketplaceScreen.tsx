import React, { useEffect, useCallback, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "@/constants/theme";
import { useMarketplace } from "@/stores/marketplaceStore";
import type { Listing } from "@/types/index";
import type { MainStackParamList } from "@/navigation/MainNavigator";
import NftList from "./components/NftList";
import FilterBar from "./components/FilterBar";
import MarketplaceHeader from "./components/MarketplaceHeader";

type Props = NativeStackScreenProps<MainStackParamList, "Marketplace">;

export default function MarketplaceScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const {
    listings,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    filter,
    pageInfo,
    totalCount,
    fetchListings,
    fetchNextPage,
    refreshListings,
    updateFilter,
    setSearch,
    clearFilters,
  } = useMarketplace();

  const initialFetchDone = useRef(false);

  // Fetch listings on mount
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchListings();
    }
  }, [fetchListings]);

  // Telemetry: track marketplace view on mount
  useEffect(() => {
    console.log("[Telemetry] marketplace_view", {
      timestamp: new Date().toISOString(),
      screen: "Marketplace",
    });
  }, []);

  const handleRefresh = useCallback(() => {
    console.log("[Telemetry] marketplace_pull_to_refresh");
    refreshListings();
  }, [refreshListings]);

  const handleLoadMore = useCallback(() => {
    console.log("[Telemetry] marketplace_load_more", {
      currentCount: listings.length,
    });
    fetchNextPage();
  }, [fetchNextPage, listings.length]);

  const handleRetry = useCallback(() => {
    console.log("[Telemetry] marketplace_retry");
    fetchListings();
  }, [fetchListings]);

  const handleNftPress = useCallback(
    (listing: Listing) => {
      console.log("[Telemetry] marketplace_nft_tap", {
        listingId: listing.id,
        nftId: listing.nftId,
        nftName: listing.nft?.name,
      });

      // Navigation to NFT detail screen will be wired when the
      // NFTDetail screen is added to MainStackParamList
      if (listing.nftId) {
        console.log(
          `[Navigation] NFT detail not yet available for: ${listing.nftId}`,
        );
      }
    },
    // navigation is stable from React Navigation, safe to omit from deps
    [],
  );

  const handleFilterApply = useCallback(
    (partialFilter: Partial<typeof filter>) => {
      console.log("[Telemetry] marketplace_filter_applied", partialFilter);
      updateFilter(partialFilter);
    },
    [updateFilter],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <MarketplaceHeader totalCount={totalCount} />

      {/* Filter Bar */}
      <FilterBar
        filter={filter}
        onSearchChange={setSearch}
        onFilterApply={handleFilterApply}
        onClearFilters={clearFilters}
      />

      {/* NFT List (main content area) */}
      <NftList
        listings={listings}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isRefreshing={isRefreshing}
        hasNextPage={pageInfo.hasNextPage}
        error={error}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onRetry={handleRetry}
        onNftPress={handleNftPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
