import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import apiClient from '@/lib/api/sample';
import { useAuthStore } from '@/stores/authStore';
import { ShareButton } from '@/components/ui/ShareButton';
import { CreatorProfile, NFT, Collection, ActivityEvent } from '@/types';

function FollowButton({ isFollowing, onPress }: { isFollowing: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.followButton, isFollowing && styles.followingButton]}
      onPress={onPress}
    >
      <Text style={[styles.followText, isFollowing && styles.followingText]}>
        {isFollowing ? 'Following' : '+ Follow'}
      </Text>
    </TouchableOpacity>
  );
}

type TabType = 'nfts' | 'collections' | 'activity';

export default function CreatorProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('nfts');
  const [isFollowing, setIsFollowing] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profileData = await apiClient.getCreatorProfile(userId);
      setProfile(profileData);
      setIsFollowing(profileData.isFollowing);

      const [nftsData, collectionsData, activityData] = await Promise.all([
        apiClient.getCreatorNFTs(userId),
        apiClient.getCreatorCollections(userId),
        apiClient.getCreatorActivity(userId),
      ]);
      setNfts(nftsData);
      setCollections(collectionsData);
      setActivity(activityData);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
    apiClient.trackEvent('creator_profile_view', { userId });
  }, [userId]);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await apiClient.unfollowUser(userId);
        setIsFollowing(false);
        setProfile((p) => p ? { ...p, isFollowing: false, followerCount: p.followerCount - 1 } : p);
      } else {
        await apiClient.followUser(userId);
        setIsFollowing(true);
        setProfile((p) => p ? { ...p, isFollowing: true, followerCount: p.followerCount + 1 } : p);
      }
      apiClient.trackEvent('profile_follow_toggle', { userId, following: !isFollowing });
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    }
  };

  const handleSocialLink = (url?: string) => {
    if (url) {
      Linking.openURL(url.startsWith('http') ? url : `https://${url}`);
    }
  };

  const isOwnProfile = user?.id === userId;

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonBanner} />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonAvatar} />
          <View style={[styles.skeletonLine, { width: '50%', height: 20, marginTop: 12 }]} />
          <View style={[styles.skeletonLine, { width: '70%', marginTop: 8 }]} />
          <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
        </View>
      </View>
    );
  }

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchProfile} tintColor="#6C5CE7" />}
    >
      {/* Banner */}
      <Image source={{ uri: profile.bannerUrl || 'https://via.placeholder.com/400x150' }} style={styles.banner} />

      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        <View style={styles.profileInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {profile.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
        </View>
        <View style={styles.profileActions}>
          {!isOwnProfile && <FollowButton isFollowing={isFollowing} onPress={handleFollow} />}
          <ShareButton
            type="creator"
            id={userId}
            title={profile.displayName}
            message={`Check out ${profile.displayName} on NFTopia!`}
            variant="icon"
            size="lg"
            testID="creator-profile-share"
          />
        </View>
      </View>

      {/* Bio */}
      {profile.bio && (
        <View style={styles.section}>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.nftCount}</Text>
          <Text style={styles.statLabel}>NFTs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.followerCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.totalVolume || '0'}</Text>
          <Text style={styles.statLabel}>Volume</Text>
        </View>
      </View>

      {/* Social Links */}
      <View style={styles.socialLinks}>
        {profile.website && (
          <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLink(profile.website)}>
            <Text style={styles.socialIcon}>🌐</Text>
            <Text style={styles.socialText}>Website</Text>
          </TouchableOpacity>
        )}
        {profile.twitter && (
          <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLink(`https://twitter.com/${profile.twitter}`)}>
            <Text style={styles.socialIcon}>🐦</Text>
            <Text style={styles.socialText}>Twitter</Text>
          </TouchableOpacity>
        )}
        {profile.instagram && (
          <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLink(`https://instagram.com/${profile.instagram}`)}>
            <Text style={styles.socialIcon}>📷</Text>
            <Text style={styles.socialText}>Instagram</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['nfts', 'collections', 'activity'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'nfts' && nfts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No NFTs created yet</Text>
          </View>
        )}
        {activeTab === 'nfts' && (
          <View style={styles.nftGrid}>
            {nfts.map((nft) => (
              <TouchableOpacity key={nft.id} style={styles.nftCard} onPress={() => navigation.navigate('NFTDetail', { nftId: nft.id })}>
                <Image source={{ uri: nft.imageUrl }} style={styles.nftImage} />
                <Text style={styles.nftName} numberOfLines={1}>{nft.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'collections' && collections.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No collections created yet</Text>
          </View>
        )}
        {activeTab === 'collections' && collections.map((col) => (
          <TouchableOpacity key={col.id} style={styles.collectionCard} onPress={() => navigation.navigate('CollectionDetail', { collectionId: col.id })}>
            <Image source={{ uri: col.imageUrl }} style={styles.collectionImageSmall} />
            <View style={{ flex: 1 }}>
              <Text style={styles.collectionNameSmall}>{col.name}</Text>
              <Text style={styles.collectionCount}>{col.nftCount} NFTs</Text>
            </View>
          </TouchableOpacity>
        ))}

        {activeTab === 'activity' && activity.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        )}
        {activeTab === 'activity' && activity.map((event) => (
          <View key={event.id} style={styles.activityItem}>
            <Text style={styles.activityIcon}>
              {event.type === 'sale' ? '💰' : event.type === 'mint' ? '🖼️' : '📌'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityText}>
                <Text style={{ fontWeight: '600' }}>{event.type.charAt(0).toUpperCase() + event.type.slice(1)}</Text>
                {' '}{event.nftName}
              </Text>
              <Text style={styles.activityTime}>{new Date(event.timestamp).toLocaleDateString()}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  banner: { width: '100%', height: 150 },
  profileHeader: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', marginTop: -40 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF' },
  profileInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  displayName: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  verifiedBadge: { fontSize: 14, color: '#6C5CE7', backgroundColor: '#6C5CE720', paddingHorizontal: 6, borderRadius: 4, marginLeft: 6, overflow: 'hidden' },
  username: { fontSize: 14, color: '#666', marginTop: 2 },
  profileActions: { alignItems: 'flex-end', gap: 8 },
  followButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#6C5CE7' },
  followingButton: { backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#6C5CE7' },
  followText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  followingText: { color: '#6C5CE7' },
  section: { padding: 16, paddingTop: 0 },
  bio: { fontSize: 14, color: '#666', lineHeight: 20 },
  statsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', margin: 16, borderRadius: 12, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#E8E8E8' },
  socialLinks: { flexDirection: 'row', padding: 16, paddingTop: 0, gap: 8 },
  socialButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F0F0' },
  socialIcon: { fontSize: 14, marginRight: 4 },
  socialText: { fontSize: 13, color: '#666' },
  tabs: { flexDirection: 'row', padding: 16, paddingBottom: 0, gap: 8 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0' },
  tabActive: { backgroundColor: '#6C5CE7' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF' },
  tabContent: { padding: 16 },
  nftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nftCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  nftImage: { width: '100%', height: 130, resizeMode: 'cover' },
  nftName: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', padding: 8 },
  collectionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8 },
  collectionImageSmall: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  collectionNameSmall: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  collectionCount: { fontSize: 12, color: '#999', marginTop: 2 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8 },
  activityIcon: { fontSize: 20, marginRight: 12 },
  activityText: { fontSize: 14, color: '#1A1A1A' },
  activityTime: { fontSize: 12, color: '#999', marginTop: 2 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: '#999' },
  skeletonBanner: { width: '100%', height: 150, backgroundColor: '#E8E8E8' },
  skeletonContent: { padding: 20, alignItems: 'center' },
  skeletonAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8E8E8' },
  skeletonLine: { height: 14, backgroundColor: '#E8E8E8', borderRadius: 7 },
});