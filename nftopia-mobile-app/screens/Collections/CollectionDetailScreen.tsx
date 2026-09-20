import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import apiClient from '@/lib/api/sample';
import { useAuthStore } from '@/stores/authStore';
import { FavoriteButton } from '@/components/ui/FavoriteButton';
import { ShareButton } from '@/components/ui/ShareButton';
import { Collection, NFT } from '@/types';

export default function CollectionDetailScreen({ route, navigation }: any) {
  const { collectionId } = route.params;
  const { user } = useAuthStore();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [collectionData, nftsData] = await Promise.all([
        apiClient.getCollectionById(collectionId),
        apiClient.getCollectionNFTs(collectionId),
      ]);
      setCollection(collectionData);
      setNfts(nftsData);
      setIsLiked(collectionData.isLiked || false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchData();
    apiClient.trackEvent('collection_detail_view', { collectionId });
  }, [collectionId]);

  const handleLike = async () => {
    try {
      if (isLiked) {
        await apiClient.unlikeCollection(collectionId);
        setIsLiked(false);
      } else {
        await apiClient.likeCollection(collectionId);
        setIsLiked(true);
      }
      apiClient.trackEvent('collection_like_toggle', { collectionId, liked: !isLiked });
    } catch (err: any) {
      console.error('Failed to toggle like:', err.message);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Collection', 'Are you sure you want to delete this collection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.deleteCollection(collectionId);
            apiClient.trackEvent('collection_deleted', { collectionId });
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const isOwner = user?.id === collection?.creatorId;

  if (loading && !collection) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonBanner} />
        <View style={styles.skeletonContent}>
          <View style={[styles.skeletonLine, { width: '60%', height: 24 }]} />
          <View style={[styles.skeletonLine, { width: '80%', marginTop: 8 }]} />
          <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
        </View>
      </View>
    );
  }

  if (error && !collection) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load collection</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!collection) return null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#6C5CE7" />}
    >
      {/* Banner */}
      <Image
        source={{ uri: collection.bannerUrl || collection.imageUrl }}
        style={styles.banner}
      />

      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: collection.imageUrl }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.name}>{collection.name}</Text>
            {collection.isVerified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
          </View>
          <Text style={styles.creator}>by {collection.creator?.username || 'Unknown'}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, isLiked && styles.actionButtonActive]} onPress={handleLike}>
          <Text style={styles.actionIcon}>{isLiked ? '❤️' : '🤍'}</Text>
          <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
            {isLiked ? 'Liked' : 'Like'}
          </Text>
        </TouchableOpacity>
        <View style={styles.favoriteWrap}>
          <FavoriteButton id={collection.id} kind="collection" size="md" testID="collection-favorite" />
        </View>
        <View style={styles.shareWrap}>
          <ShareButton
            type="collection"
            id={collection.id}
            title={collection.name}
            message={`Check out the ${collection.name} collection on NFTopia!`}
            variant="icon"
            size="md"
            testID="collection-share"
          />
        </View>
        {isOwner && (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('EditCollection', { collectionId })}>
              <Text style={styles.actionIcon}>✏️</Text>
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionText, { color: '#E17055' }]}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Description */}
      {collection.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{collection.description}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{collection.nftCount}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        {collection.floorPrice && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{collection.floorPrice} XLM</Text>
            <Text style={styles.statLabel}>Floor Price</Text>
          </View>
        )}
        {collection.volumeTraded && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{collection.volumeTraded} XLM</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
        )}
      </View>

      {/* NFTs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NFTs in Collection</Text>
        {nfts.length === 0 ? (
          <View style={styles.emptyNFTs}>
            <Text style={styles.emptyText}>No NFTs in this collection yet</Text>
          </View>
        ) : (
          <View style={styles.nftGrid}>
            {nfts.map((nft) => (
              <TouchableOpacity
                key={nft.id}
                style={styles.nftCard}
                onPress={() => navigation.navigate('NFTDetail', { nftId: nft.id })}
              >
                <Image source={{ uri: nft.imageUrl }} style={styles.nftImage} />
                <Text style={styles.nftName} numberOfLines={1}>{nft.name}</Text>
                <Text style={styles.nftPrice}>{nft.price} {nft.currency}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  banner: { width: '100%', height: 180 },
  header: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', marginTop: -40 },
  avatar: { width: 80, height: 80, borderRadius: 16, borderWidth: 3, borderColor: '#FFFFFF' },
  headerInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  verifiedBadge: { fontSize: 12, color: '#6C5CE7', backgroundColor: '#6C5CE720', paddingHorizontal: 6, borderRadius: 4, marginLeft: 6, overflow: 'hidden' },
  creator: { fontSize: 14, color: '#666', marginTop: 4 },
  actions: { flexDirection: 'row', padding: 16, gap: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F0F0F0' },
  actionButtonActive: { backgroundColor: '#6C5CE720' },
  actionIcon: { fontSize: 16, marginRight: 6 },
  actionText: { fontSize: 14, color: '#666', fontWeight: '500' },
  actionTextActive: { color: '#6C5CE7' },
  favoriteWrap: { justifyContent: 'center' },
  shareWrap: { justifyContent: 'center' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 },
  description: { fontSize: 14, color: '#666', lineHeight: 20 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statItem: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  nftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nftCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  nftImage: { width: '100%', height: 140, resizeMode: 'cover' },
  nftName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', padding: 8, paddingBottom: 2 },
  nftPrice: { fontSize: 12, color: '#6C5CE7', paddingHorizontal: 8, paddingBottom: 8 },
  emptyNFTs: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: '#999' },
  skeletonBanner: { width: '100%', height: 180, backgroundColor: '#E8E8E8' },
  skeletonContent: { padding: 20 },
  skeletonLine: { height: 14, backgroundColor: '#E8E8E8', borderRadius: 7 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#6C5CE7', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});