import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/MainNavigator';
import { colors, spacing } from '@/constants/theme';
import { useMarketplaceListings } from '@/hooks/useMarketplaceListings';
import { useMarketplaceFiltersStore } from '@/stores/marketplaceFiltersStore';
import type { MarketplaceListingCard as MarketplaceListingCardVM, MarketplaceSortOption } from '@/src/utils/marketplaceViewModels';
import { getActiveMarketplaceFilterCount } from '@/src/utils/marketplaceViewModels';
import { ErrorFallback } from '@/src/components/ErrorFallback';
import { withErrorBoundary } from '@/src/hoc/withErrorBoundary';
import { useAnalytics } from '@/src/hooks/useAnalytics';
import { usePullToRefresh } from '@/src/hooks/usePullToRefresh';
import { MarketplaceCardSkeleton } from '@/src/components/skeletons';
import { PullToRefresh } from '@/src/components/PullToRefresh';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';
import { analyticsService } from '@/src/analytics/analytics.service';
import { errorLogger } from '@/src/errors/logger';
import MarketplaceListingCard from '@/components/ui/MarketplaceListingCard';
import MarketplaceSearchBar from '@/components/ui/MarketplaceSearchBar';
import MarketplaceSortBar from '@/components/ui/MarketplaceSortBar';
import FilterSheet from '@/components/ui/FilterSheet';

const GRID_COLUMNS = 2;

function MarketplaceContent() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Marketplace'>>();
  const { track, trackScreenView, trackPerformance } = useAnalytics();

  const [search, setSearch] = useState('');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const filters = useMarketplaceFiltersStore();
  const { setCategory, setStatus, setPriceRange, setSortBy, clearAll } = filters;

  // A category deep-linked from Home (e.g. tapping a discovery chip) takes
  // over the persisted filter for this visit; a plain back-navigation into
  // Marketplace (no param) leaves whatever the user last filtered by alone.
  useEffect(() => {
    if (route.params?.category) {
      setCategory(route.params.category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.category]);

  const { listings, loading, error, loadMore, refetch } = useMarketplaceListings({
    filters,
    search: search || undefined,
  });

  const {
    isRefreshing,
    error: refreshError,
    lastUpdated,
    handleRefresh,
    getLastUpdatedText,
    cooldownRemaining,
  } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
    cooldown: 2000,
    hapticFeedback: true,
    trackAnalytics: true,
    analyticsEvent: 'marketplace_refresh',
  });

  const activeFilterCount = getActiveMarketplaceFilterCount(filters);

  const handleSearchChange = (query: string) => {
    setSearch(query);
    if (query) {
      track(ANALYTICS_EVENTS.SEARCH, { screen: 'marketplace', query });
    }
  };

  const handleSearchSubmit = (query: string) => {
    const q = (query || search).trim();
    if (!q) return;
    track(ANALYTICS_EVENTS.SEARCH, { screen: 'marketplace', query: q, action: 'submit' });
    navigation.navigate('SearchResults', { query: q });
  };

  const handleSortChange = (option: MarketplaceSortOption) => {
    setSortBy(option);
    track(ANALYTICS_EVENTS.SEARCH_FILTER, { screen: 'marketplace', sortBy: option });
  };

  const handleApplyFilters = (draft: {
    category?: string;
    status: typeof filters.status;
    minPrice?: number;
    maxPrice?: number;
  }) => {
    setCategory(draft.category);
    setStatus(draft.status);
    setPriceRange(draft.minPrice, draft.maxPrice);
    track(ANALYTICS_EVENTS.SEARCH_FILTER, {
      screen: 'marketplace',
      categoryId: draft.category,
      status: draft.status,
      minPrice: draft.minPrice,
      maxPrice: draft.maxPrice,
    });
    setFilterSheetVisible(false);
  };

  const handleClearAllFilters = () => {
    clearAll();
    track(ANALYTICS_EVENTS.SEARCH_FILTER, { screen: 'marketplace', cleared: true });
    setFilterSheetVisible(false);
  };

  useEffect(() => {
    trackScreenView('Marketplace');
  }, [trackScreenView]);

  const handleListingPress = (item: MarketplaceListingCardVM) => {
    track(ANALYTICS_EVENTS.NFT_VIEW, {
      nftId: item.nftId,
      nftName: item.name,
      source: 'marketplace_grid',
    });
    navigation.navigate('NFTDetail', { nftId: item.nftId });
  };

  const renderItem = ({ item }: { item: MarketplaceListingCardVM }) => (
    <MarketplaceListingCard
      item={item}
      onPress={handleListingPress}
      onImageLoad={(listing) => {
        trackPerformance('image_load_time', Date.now(), {
          nftId: listing.nftId,
          type: 'marketplace',
        });
      }}
      onImageError={(listing, err) => {
        errorLogger.log(err, 'MarketplaceImage', undefined, { nftId: listing.nftId });
        track(ANALYTICS_EVENTS.ERROR_OCCURRED, {
          component: 'MarketplaceImage',
          nftId: listing.nftId,
          error: err.message,
        });
      }}
    />
  );

  const renderFooter = () => {
    if (!loading || listings.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer} testID="marketplace-empty">
      <Text style={styles.emptyTitle}>{t('marketplace.noNFTs')}</Text>
      <Text style={styles.emptyMessage}>{t('marketplace.noNFTsMessage')}</Text>
    </View>
  );

  const showFullScreenError = error && listings.length === 0;
  const showInitialLoading = loading && listings.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            track('marketplace_back');
            navigation.goBack();
          }}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('marketplace.title')}</Text>
      </View>

      <View style={styles.filters}>
        <View style={styles.filtersTopRow}>
          <View style={styles.searchWrapper}>
            <MarketplaceSearchBar onSearchChange={handleSearchChange} onSubmit={handleSearchSubmit} testID="marketplace-search" />
            <TouchableOpacity
              onPress={() => handleSearchSubmit(search)}
              accessibilityRole="button"
              accessibilityLabel="Search"
              style={{ marginLeft: 8, padding: 8 }}
            >
              <Text style={{ color: '#6C5CE7', fontWeight: '600' }}>Go</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.filterTrigger}
            onPress={() => {
              track(ANALYTICS_EVENTS.SEARCH_FILTER, { screen: 'marketplace', action: 'open_sheet' });
              setFilterSheetVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0
                ? `${t('marketplace.filters.trigger')} (${activeFilterCount})`
                : t('marketplace.filters.trigger')
            }
            testID="marketplace-filter-trigger"
          >
            <Text style={styles.filterTriggerText}>{t('marketplace.filters.trigger')}</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge} testID="marketplace-filter-badge">
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <MarketplaceSortBar selected={filters.sortBy} onSelect={handleSortChange} testID="marketplace-sort" />
      </View>

      <FilterSheet
        visible={filterSheetVisible}
        filters={filters}
        onApply={handleApplyFilters}
        onClearAll={handleClearAllFilters}
        onClose={() => setFilterSheetVisible(false)}
        testID="marketplace-filter-sheet"
      />

      {showFullScreenError ? (
        <ErrorFallback
          error={error}
          onRetry={() => {
            track('marketplace_refresh');
            handleRefresh();
          }}
          customMessage="Failed to load NFTs. Please check your connection and try again."
        />
      ) : showInitialLoading ? (
        <MarketplaceCardSkeleton count={4} animated variant="grid" />
      ) : (
        <PullToRefresh
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          loading={loading}
          error={refreshError}
          onRetry={handleRefresh}
          lastUpdated={lastUpdated}
          getLastUpdatedText={getLastUpdatedText}
          cooldownRemaining={cooldownRemaining}
          tintColor="#6C5CE7"
          title="Pull to refresh marketplace"
        >
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              track('marketplace_load_more', { currentCount: listings.length });
              loadMore();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
          />
        </PullToRefresh>
      )}
    </View>
  );
}

const MarketplaceScreen = withErrorBoundary(MarketplaceContent, {
  name: 'MarketplaceScreen',
  onError: (error, errorInfo) => {
    errorLogger.log(error, 'MarketplaceScreen', undefined, { componentStack: errorInfo.componentStack });
    analyticsService.trackError(error, { componentStack: errorInfo.componentStack });
  },
});

export default MarketplaceScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.text,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  filters: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchWrapper: {
    flex: 1,
  },
  filterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.xs,
  },
  filterTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    flexGrow: 1,
  },
  row: {
    gap: spacing.md,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
