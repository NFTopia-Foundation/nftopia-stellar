import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/MainNavigator';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useWalletStore } from '@/stores/walletStore';
import { useAuthStore } from '@/stores/authStore';
import { useTrendingCollections } from '@/hooks/useTrendingCollections';
import { useNewListings } from '@/hooks/useNewListings';
import BalanceDisplay from '@/components/wallet/BalanceDisplay';
import CategorySelector from '@/components/ui/CategorySelector';
import TrendingCarousel from '@/components/ui/TrendingCarousel';
import NewDropsSection from '@/components/ui/NewDropsSection';
import RecentlyViewedRow from '@/components/ui/RecentlyViewedRow';
import type { Category } from '@/constants/categories';
import type {
  NewDropCard,
  TrendingCollectionCard,
} from '@/src/utils/discoveryViewModels';
import { withErrorBoundary } from '@/src/hoc/withErrorBoundary';
import { errorLogger } from '@/src/errors/logger';
import { ErrorFallback } from '@/src/components/ErrorFallback';
import { HomeSkeleton } from '@/src/components/skeletons';
import { usePullToRefresh } from '@/src/hooks/usePullToRefresh';
import { PullToRefresh } from '@/src/components/PullToRefresh';
import { useAnalytics } from '@/src/hooks/useAnalytics';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';

function HomeContent() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const {
    activeWallet,
    activePublicKey,
    activeBalance,
    isLoading,
    error,
    fetchBalances,
  } = useWalletConnect();
  const network = useWalletStore((s) => s.network);
  const { track } = useAnalytics();

  const {
    collections: trendingCollections,
    loading: trendingLoading,
    error: trendingError,
    refetch: refetchTrending,
  } = useTrendingCollections();

  const {
    drops: newDrops,
    loading: newDropsLoading,
    error: newDropsError,
    refetch: refetchNewDrops,
  } = useNewListings();

  const {
    isRefreshing,
    error: refreshError,
    lastUpdated,
    handleRefresh,
    getLastUpdatedText,
    cooldownRemaining,
  } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        activePublicKey ? fetchBalances(activePublicKey) : Promise.resolve(),
        refetchTrending(),
        refetchNewDrops(),
      ]);
    },
    cooldown: 2000,
    hapticFeedback: true,
    trackAnalytics: true,
    analyticsEvent: 'home_refresh',
  });

  const handleSelectCategory = useCallback(
    (category: Category) => {
      track(ANALYTICS_EVENTS.DISCOVERY_CATEGORY_SELECT, {
        categoryId: category.id,
      });
      navigation.navigate('Marketplace', { category: category.id });
    },
    [navigation, track]
  );

  const handleTrendingImpression = useCallback(
    (items: TrendingCollectionCard[]) => {
      track(ANALYTICS_EVENTS.DISCOVERY_TRENDING_IMPRESSION, {
        count: items.length,
        collectionIds: items.map((item) => item.id),
      });
    },
    [track]
  );

  const handleTrendingItemPress = useCallback(
    (item: TrendingCollectionCard) => {
      track(ANALYTICS_EVENTS.DISCOVERY_TRENDING_ITEM_CLICK, {
        collectionId: item.id,
      });
      navigation.navigate('Marketplace');
    },
    [navigation, track]
  );

  const handleNewDropsImpression = useCallback(
    (items: NewDropCard[]) => {
      track(ANALYTICS_EVENTS.DISCOVERY_NEW_DROPS_IMPRESSION, {
        count: items.length,
        nftIds: items.map((item) => item.nftId),
      });
    },
    [track]
  );

  const handleNewDropPress = useCallback(
    (item: NewDropCard) => {
      track(ANALYTICS_EVENTS.DISCOVERY_NEW_DROPS_ITEM_CLICK, {
        nftId: item.nftId,
      });
      navigation.navigate('NFTDetail', { nftId: item.nftId });
    },
    [navigation, track]
  );

  useEffect(() => {
    if (activePublicKey) {
      fetchBalances(activePublicKey);
    }
  }, [activePublicKey, fetchBalances]);

  // Show skeleton while loading
  if (isLoading && !activeWallet) {
    return <HomeSkeleton />;
  }

  if (!activeWallet) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t('home.noWallet')}</Text>
        <Text style={styles.emptySubtitle}>{t('home.noWalletSubtitle')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ErrorFallback
        error={error ? new Error(error) : null}
        onRetry={handleRefresh}
        customMessage="Failed to load wallet data. Please try again."
      />
    );
  }

  const greetingName = user?.email?.split('@')[0] || t('home.greetingDefault');

  return (
    <PullToRefresh
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      loading={isLoading}
      error={refreshError}
      onRetry={handleRefresh}
      lastUpdated={lastUpdated}
      getLastUpdatedText={getLastUpdatedText}
      cooldownRemaining={cooldownRemaining}
      tintColor="#6C5CE7"
      title="Pull to refresh wallet"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting} accessibilityRole="header">
              {t('home.greeting', { name: greetingName })}
            </Text>
            <Text style={styles.subGreeting}>{t('home.title')}</Text>
          </View>
          <View
            style={styles.networkBadge}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Network: ${network === 'testnet' ? t('home.testnet') : t('home.mainnet')}`}
          >
            <Text style={styles.networkBadgeText}>
              {network === 'testnet' ? t('home.testnet') : t('home.mainnet')}
            </Text>
          </View>
        </View>

        <BalanceDisplay
          xlmBalance={activeBalance?.xlm ?? null}
          tokenBalances={activeBalance?.tokens ?? []}
          isLoading={isLoading}
          error={error}
          onRefresh={handleRefresh}
          publicKey={activePublicKey ?? undefined}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('home.discovery.categoriesTitle')}
          </Text>
          <CategorySelector
            onSelectCategory={handleSelectCategory}
            testID="home-category-selector"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('home.discovery.trending.title')}
          </Text>
          <TrendingCarousel
            data={trendingCollections}
            loading={trendingLoading}
            error={Boolean(trendingError)}
            onItemPress={handleTrendingItemPress}
            onImpression={handleTrendingImpression}
            testID="home-trending-carousel"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('home.discovery.newDrops.title')}
          </Text>
          <NewDropsSection
            data={newDrops}
            loading={newDropsLoading}
            error={Boolean(newDropsError)}
            onItemPress={handleNewDropPress}
            onImpression={handleNewDropsImpression}
            testID="home-new-drops"
          />
        </View>

        <RecentlyViewedRow testID="home-recently-viewed" />

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Marketplace')}
            accessibilityRole="button"
            accessibilityLabel={t('home.actions.marketplace')}
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🛍️</Text>
            <Text style={styles.actionLabel}>{t('home.actions.marketplace')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Auctions')}
            accessibilityRole="button"
            accessibilityLabel="Auctions"
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🔨</Text>
            <Text style={styles.actionLabel}>Auctions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Collections')}
            accessibilityRole="button"
            accessibilityLabel="Collections"
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📚</Text>
            <Text style={styles.actionLabel}>Collections</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Assistant')}
            accessibilityRole="button"
            accessibilityLabel="AI Assistant"
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🤖</Text>
            <Text style={styles.actionLabel}>Assistant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Send')}
            accessibilityRole="button"
            accessibilityLabel={t('home.actions.send')}
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📤</Text>
            <Text style={styles.actionLabel}>{t('home.actions.send')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            accessibilityRole="button"
            accessibilityLabel={t('home.actions.receive')}
            accessibilityHint="Coming soon"
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📥</Text>
            <Text style={styles.actionLabel}>{t('home.actions.receive')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            accessibilityRole="button"
            accessibilityLabel={t('home.actions.swap')}
            accessibilityHint="Coming soon"
          >
            <Text style={styles.actionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🔄</Text>
            <Text style={styles.actionLabel}>{t('home.actions.swap')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </PullToRefresh>
  );
}

const HomeScreen = withErrorBoundary(HomeContent, {
  name: 'HomeScreen',
  onError: (error, errorInfo) => {
    errorLogger.log(
      error,
      'HomeScreen',
      undefined,
      { componentStack: errorInfo.componentStack }
    );
  },
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 60,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subGreeting: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  networkBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
