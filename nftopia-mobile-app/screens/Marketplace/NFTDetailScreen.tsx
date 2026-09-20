import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { MainStackParamList } from '@/navigation/MainNavigator';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import TransferHistory from '@/components/wallet/TransferHistory';
import { useNFTDetail } from '@/hooks/useNFTDetail';
import { OptimizedImage } from '@/src/components/OptimizedImage';
import { ImageGallery } from '@/src/components/ImageGallery';
import { NFTDetailSkeleton } from '@/src/components/skeletons';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { FavoriteButton } from '@/components/ui/FavoriteButton';
import { ShareButton } from '@/components/ui/ShareButton';

type NFTDetailRouteProp = RouteProp<MainStackParamList, 'NFTDetail'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function NFTDetailScreen() {
  const route = useRoute<NFTDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { nftId } = route.params;

  const { nft, loading: isLoading, error, refetch } = useNFTDetail(nftId);
  const trackView = useRecentlyViewedStore((s) => s.trackView);

  useEffect(() => {
    if (nft) {
      trackView(nft.id);
    }
  }, [nft, trackView]);

  const copyToClipboard = async (text: string, type: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${type} address copied to clipboard.`);
  };

  const renderError = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{error?.message || 'NFT not found.'}</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && !nft) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
            <Text style={styles.headerBackText}>←</Text>
          </TouchableOpacity>
        </View>
        <NFTDetailSkeleton animated={true} />
      </View>
    );
  }

  if (error || !nft) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
            <Text style={styles.headerBackText}>←</Text>
          </TouchableOpacity>
        </View>
        {renderError()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {nft.name}
        </Text>
        <View style={styles.headerActions}>
          <ShareButton
            type="nft"
            id={nft.id}
            title={nft.name}
            message={`Check out ${nft.name} on NFTopia!`}
            variant="icon"
            size="md"
            testID="nft-detail-share"
          />
          <FavoriteButton id={nft.id} kind="nft" size="md" testID="nft-detail-favorite" />
        </View>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        <ImageGallery
          images={[nft.imageUrl]}
          initialIndex={0}
          showThumbnails={true}
        />

        <View style={styles.content}>
          <Text style={styles.title}>{nft.name}</Text>
          <Text style={styles.description}>{nft.description}</Text>

          {/* Creator and Owner */}
          <View style={styles.addressSection}>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>Creator</Text>
              <TouchableOpacity style={styles.addressPill} onPress={() => copyToClipboard(nft.creator.address, 'Creator')}>
                <Text style={styles.addressText}>{nft.creator.username || nft.creator.address}</Text>
                <Text style={styles.copyIcon}>📋</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>Owner</Text>
              <TouchableOpacity style={styles.addressPill} onPress={() => copyToClipboard(nft.owner.address, 'Owner')}>
                <Text style={styles.addressText}>{nft.owner.username || nft.owner.address}</Text>
                <Text style={styles.copyIcon}>📋</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Attributes Grid */}
          {nft.attributes && nft.attributes.length > 0 && (
            <View style={styles.attributesSection}>
              <Text style={styles.sectionTitle}>Attributes</Text>
              <View style={styles.attributesGrid}>
                {nft.attributes.map((attr, index) => (
                  <View key={index} style={styles.attributeCard}>
                    <Text style={styles.attributeType}>{attr.trait_type}</Text>
                    <Text style={styles.attributeValue}>{attr.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Transfer History */}
          <TransferHistory events={nft.history} isLoading={isLoading} />
        </View>
      </ScrollView>
    </View>
  );
}

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
  headerBackButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerBackText: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  addressSection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  addressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressText: {
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.xs,
  },
  copyIcon: {
    fontSize: 14,
  },
  attributesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  attributesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attributeCard: {
    flexBasis: '48%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attributeType: {
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  attributeValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    marginBottom: spacing.md,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});