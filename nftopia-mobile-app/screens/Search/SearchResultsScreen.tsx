import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSearchStore } from '@/stores/searchStore';
import SearchBar from './SearchBar';
import apiClient from '@/lib/api/sample';
import { NFT, Collection, CreatorProfile } from '@/types';

type TabType = 'all' | 'nfts' | 'collections' | 'creators';

function NFTCard({ nft, onPress }: { nft: NFT; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress}>
      <Image source={{ uri: nft.imageUrl }} style={styles.resultImage} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>{nft.name}</Text>
        <Text style={styles.resultPrice}>{nft.price} {nft.currency}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CollectionCard({ collection, onPress }: { collection: Collection; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress}>
      <Image source={{ uri: collection.imageUrl }} style={styles.resultImage} />
      <View style={styles.resultInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.resultName} numberOfLines={1}>{collection.name}</Text>
          {collection.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
        </View>
        <Text style={styles.resultSubtitle}>{collection.nftCount} NFTs</Text>
      </View>
    </TouchableOpacity>
  );
}

function CreatorCard({ creator, onPress }: { creator: CreatorProfile; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.creatorCard} onPress={onPress}>
      <Image source={{ uri: creator.avatarUrl }} style={styles.creatorAvatar} />
      <View style={styles.creatorInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.creatorName} numberOfLines={1}>{creator.displayName}</Text>
          {creator.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
        </View>
        <Text style={styles.creatorSubtitle}>{creator.followerCount} followers</Text>
      </View>
    </TouchableOpacity>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonInfo}>
            <View style={[styles.skeletonLine, { width: '70%' }]} />
            <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SearchResultsScreen({ navigation, route }: any) {
  const { query, results, filters, loading, error, recentSearches, setFilters, clearSearch, clearRecentSearches, search, setQuery } = useSearchStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const routeQuery: string | undefined = route?.params?.query;

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'nfts', label: 'NFTs' },
    { key: 'collections', label: 'Collections' },
    { key: 'creators', label: 'Creators' },
  ];

  useEffect(() => {
    if (routeQuery && routeQuery.trim() && routeQuery !== query) {
      setQuery(routeQuery);
      search(routeQuery);
    }
  }, [routeQuery]);

  useEffect(() => {
    apiClient.trackEvent('search_results_view', { query, tab: activeTab });
  }, [query, activeTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setFilters({ type: tab });
  };

  const getFilteredResults = () => {
    if (!results) return { nfts: [], collections: [], creators: [] };
    if (activeTab === 'all') return results;
    return {
      nfts: activeTab === 'nfts' ? results.nfts : [],
      collections: activeTab === 'collections' ? results.collections : [],
      creators: activeTab === 'creators' ? results.creators : [],
    };
  };

  const filtered = getFilteredResults();

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === 'creators') {
      return <CreatorCard creator={item} onPress={() => navigation.navigate('CreatorProfile', { userId: item.id })} />;
    }
    if (activeTab === 'collections') {
      return <CollectionCard collection={item} onPress={() => navigation.navigate('CollectionDetail', { collectionId: item.id })} />;
    }
    return <NFTCard nft={item} onPress={() => navigation.navigate('NFTDetail', { nftId: item.id })} />;
  };

  const data = activeTab === 'all'
    ? [...filtered.nfts, ...filtered.collections, ...filtered.creators]
    : activeTab === 'nfts' ? filtered.nfts
    : activeTab === 'collections' ? filtered.collections
    : filtered.creators;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SearchBar autoFocus />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Searches */}
      {!query && recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={clearRecentSearches}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((search, index) => (
            <TouchableOpacity key={index} style={styles.recentItem}>
              <Text style={styles.recentIcon}>🕐</Text>
              <Text style={styles.recentSearchText}>{search}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {!loading && query && (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try different keywords or filters</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, paddingTop: 60, backgroundColor: '#FFFFFF' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F0F0F0' },
  tabActive: { backgroundColor: '#6C5CE7' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF' },
  recentSection: { padding: 16 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  recentTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  clearText: { fontSize: 14, color: '#6C5CE7' },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  recentIcon: { fontSize: 16, marginRight: 10 },
  recentSearchText: { fontSize: 14, color: '#666' },
  resultsList: { padding: 16 },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  resultImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  resultInfo: { flex: 1, justifyContent: 'center' },
  resultName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  resultPrice: { fontSize: 13, color: '#6C5CE7', marginTop: 2 },
  resultSubtitle: { fontSize: 12, color: '#999', marginTop: 2 },
  verifiedBadge: {
    fontSize: 12,
    color: '#6C5CE7',
    backgroundColor: '#6C5CE720',
    paddingHorizontal: 4,
    borderRadius: 4,
    marginLeft: 4,
    overflow: 'hidden',
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  creatorAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  creatorSubtitle: { fontSize: 12, color: '#999', marginTop: 2 },
  skeletonContainer: { padding: 16 },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  skeletonImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#E8E8E8', marginRight: 12 },
  skeletonInfo: { flex: 1, justifyContent: 'center' },
  skeletonLine: { height: 12, backgroundColor: '#E8E8E8', borderRadius: 6 },
  errorContainer: { padding: 20, alignItems: 'center' },
  errorText: { fontSize: 14, color: '#E17055', textAlign: 'center' },
  emptyContainer: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
});