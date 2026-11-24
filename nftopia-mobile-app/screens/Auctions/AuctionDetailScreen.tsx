import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuctionStore } from '@/stores/auctionStore';
import apiClient from '@/lib/api/sample';
import { haptics } from '@/lib/haptics';
import ConfirmationDialog from '@/components/wallet/ConfirmationDialog';
import { StellarWalletService } from '@/src/services/stellar/wallet.service';
import { useWalletStore } from '@/stores/walletStore';
import { useAuthStore } from '@/stores/authStore';
import { Auction, Bid } from '@/types';

export type AuctionOutcome = 'won' | 'lost' | 'reserve_not_met' | 'seller_sold' | 'seller_unsold' | 'awaiting_settlement';

export function shouldPollAuction(auction: Auction | null): boolean {
  return Boolean(auction && auction.status !== 'settled' && auction.status !== 'cancelled');
}

export function deriveAuctionOutcome(
  auction: Auction,
  bidHistory: Bid[],
  currentUserId?: string,
): AuctionOutcome {
  const ended = auction.status === 'ended' || auction.status === 'settled' || new Date(auction.endTime).getTime() <= Date.now();
  if (!ended) return 'awaiting_settlement';
  const highest = bidHistory.find((bid) => bid.isWinning) ?? bidHistory[0];
  const reserve = auction.reservePrice ? Number(auction.reservePrice) : null;

  if (auction.status === 'settled') {
    if (!highest) {
      if (currentUserId && auction.creatorId === currentUserId) return 'seller_unsold';
      return 'reserve_not_met';
    }
    if (reserve !== null && Number(highest.amount) < reserve) return 'reserve_not_met';
    if (currentUserId && auction.creatorId === currentUserId) return 'seller_sold';
    if (highest && currentUserId && highest.bidderId === currentUserId) return 'won';
    if (highest) return 'lost';
  }

  if (auction.status === 'settled' && !highest) {
    if (currentUserId && auction.creatorId === currentUserId) return 'seller_unsold';
  }
  if (auction.status === 'ended') {
    if (reserve !== null && (!highest || Number(highest.amount) < reserve)) return 'reserve_not_met';
    return 'awaiting_settlement';
  }
  if (currentUserId && auction.creatorId === currentUserId) return 'seller_unsold';
  return 'awaiting_settlement';
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Ended');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const isUrgent = new Date(endTime).getTime() - Date.now() < 3600000;

  return (
    <View style={[styles.timerContainer, isUrgent && styles.timerUrgent]}>
      <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>{remaining}</Text>
    </View>
  );
}

export default function AuctionDetailScreen({ route, navigation }: any) {
  const { auctionId } = route.params;
  const { currentAuction, bidHistory, loading, placeBid, toggleWatch, fetchAuctionById, fetchBidHistory, watchedAuctions } = useAuctionStore();
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState('0.00001');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const network = useWalletStore((state) => state.network);
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    fetchAuctionById(auctionId);
    fetchBidHistory(auctionId);
  }, [auctionId]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const shouldPoll = shouldPollAuction(currentAuction);
    if (!shouldPoll) return;
    pollRef.current = setInterval(() => {
      fetchAuctionById(auctionId);
      fetchBidHistory(auctionId);
    }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [auctionId, currentAuction?.status, currentAuction?.endTime]);

  const openBidConfirmation = async () => {
    if (!currentAuction) return;
    setConfirmVisible(true);
    try {
      const estimate = await new StellarWalletService(undefined, network).estimateFee(['Manage Offer']);
      setEstimatedFee(estimate.totalFeeXlm);
    } catch {
      setEstimatedFee('0.00001');
    }
  };

  const handleBid = async () => {
    if (!currentAuction) return;
    setSubmitting(true);
    try {
      await placeBid(auctionId, bidAmount);
      setConfirmVisible(false);
      setBidAmount('');
      haptics.success();
      Alert.alert('Success', 'Your bid has been placed!');
    } catch (err: any) {
      haptics.error();
      Alert.alert('Bid Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWatch = async () => {
    await toggleWatch(auctionId);
  };

  if (!currentAuction) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading auction...</Text>
      </View>
    );
  }

  const minBid = (parseFloat(currentAuction.currentPrice) + 0.1).toFixed(2);
  const isWatched = watchedAuctions.includes(auctionId);
  const isEnded = new Date(currentAuction.endTime).getTime() <= Date.now() || currentAuction.status === 'ended' || currentAuction.status === 'settled';
  const outcome = deriveAuctionOutcome(currentAuction, bidHistory, currentUser?.id);
  const bidNumber = Number(bidAmount);
  const currentPriceNumber = Number(currentAuction.currentPrice);
  const increment = Number.isFinite(bidNumber) && Number.isFinite(currentPriceNumber) ? bidNumber - currentPriceNumber : 0;
  const largeJump = Number.isFinite(bidNumber) && Number.isFinite(currentPriceNumber) && currentPriceNumber > 0 && bidNumber > currentPriceNumber * 5;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchAuctionById(auctionId)} tintColor="#6C5CE7" />}>
      <Image source={{ uri: currentAuction.nftImage }} style={styles.image} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{currentAuction.nftName}</Text>
          {currentAuction.isWatched && <Text style={styles.watchBadge}>👁️</Text>}
        </View>
        <Text style={styles.creator}>by {currentAuction.creatorName}</Text>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Current Bid</Text>
            <Text style={styles.price}>{currentAuction.currentPrice} {currentAuction.currency}</Text>
          </View>
          <CountdownTimer endTime={currentAuction.endTime} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{currentAuction.bidCount}</Text>
            <Text style={styles.statLabel}>Bids</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{currentAuction.startPrice}</Text>
            <Text style={styles.statLabel}>Start Price</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{isEnded ? 'Ended' : 'Active'}</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {isEnded ? (
          <View style={styles.endedBanner}>
            {outcome === 'won' ? (
              <>
                <Text style={styles.endedText}>You won this auction</Text>
                <TouchableOpacity style={styles.outcomeAction} onPress={() => navigation.navigate('NFTDetail', { nftId: currentAuction.nftId })}>
                  <Text style={styles.outcomeActionText}>View in your collection</Text>
                </TouchableOpacity>
              </>
            ) : outcome === 'lost' ? (
              <Text style={styles.endedText}>You were outbid. This auction was won by another bidder.</Text>
            ) : outcome === 'reserve_not_met' ? (
              <Text style={styles.endedText}>Reserve not met. The auction did not sell.</Text>
            ) : outcome === 'seller_sold' ? (
              <Text style={styles.endedText}>Sold. Your auction has settled.</Text>
            ) : outcome === 'seller_unsold' ? (
              <Text style={styles.endedText}>Unsold. The reserve was not met or there were no bids.</Text>
            ) : (
              <Text style={styles.endedText}>Auction ended. Awaiting settlement.</Text>
            )}
          </View>
        ) : (
          <View style={styles.bidSection}>
            <Text style={styles.bidLabel}>Place Bid</Text>
            <View style={styles.bidRow}>
              <TextInput
                style={styles.bidInput}
                value={bidAmount}
                onChangeText={setBidAmount}
                placeholder={`Min: ${minBid}`}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.bidButton, submitting && styles.bidButtonDisabled]}
                onPress={openBidConfirmation}
                disabled={submitting || !bidAmount || parseFloat(bidAmount) < parseFloat(minBid)}
              >
                <Text style={styles.bidButtonText}>{submitting ? '...' : 'Place Bid'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      <ConfirmationDialog
        visible={confirmVisible}
        title="Confirm bid"
        message={`Review your bid for ${currentAuction.nftName}.`}
        confirmLabel={submitting ? 'Submitting...' : 'Confirm bid'}
        confirmDisabled={submitting}
        onCancel={() => { if (!submitting) setConfirmVisible(false); }}
        onConfirm={handleBid}
      >
        <View style={styles.confirmDetails}>
          <Text style={styles.confirmText}>Bid amount: {bidAmount} {currentAuction.currency}</Text>
          <Text style={styles.confirmText}>Current highest bid: {currentAuction.currentPrice} {currentAuction.currency}</Text>
          <Text style={styles.confirmText}>Increment: {increment.toFixed(2)} {currentAuction.currency}</Text>
          <Text style={styles.confirmText}>Estimated network fee: {estimatedFee} XLM</Text>
          {largeJump ? <Text style={styles.largeJumpWarning}>Warning: this bid is more than 5x the current price.</Text> : null}
        </View>
      </ConfirmationDialog>

        <TouchableOpacity style={styles.watchButton} onPress={handleWatch}>
          <Text style={styles.watchIcon}>{isWatched ? '🔔 Watching' : '🔕 Watch'}</Text>
        </TouchableOpacity>

        {/* Bid History */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Bid History</Text>
          {bidHistory.length === 0 ? (
            <Text style={styles.noBids}>No bids yet. Be the first!</Text>
          ) : (
            bidHistory.map((bid) => (
              <View key={bid.id} style={styles.bidItem}>
                <View>
                  <Text style={styles.bidderName}>{bid.bidderName}</Text>
                  <Text style={styles.bidTime}>{new Date(bid.timestamp).toLocaleString()}</Text>
                </View>
                <View style={styles.bidAmountContainer}>
                  <Text style={styles.bidAmount}>{bid.amount} {bid.currency}</Text>
                  {bid.isWinning && <Text style={styles.winningText}>Winning</Text>}
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  image: { width: '100%', height: 300, resizeMode: 'cover' },
  content: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', flex: 1 },
  watchBadge: { fontSize: 20, marginLeft: 8 },
  creator: { fontSize: 14, color: '#666', marginTop: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  priceLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  price: { fontSize: 24, fontWeight: 'bold', color: '#6C5CE7' },
  timerContainer: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F0F0F0' },
  timerUrgent: { backgroundColor: '#FFE0E0' },
  timerText: { fontSize: 14, color: '#666', fontWeight: '600', fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#E17055' },
  statsRow: { flexDirection: 'row', marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  divider: { width: 1, backgroundColor: '#E8E8E8' },
  bidSection: { marginTop: 24 },
  bidLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  bidRow: { flexDirection: 'row', gap: 8 },
  bidInput: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', padding: 14, fontSize: 16, color: '#1A1A1A' },
  bidButton: { backgroundColor: '#6C5CE7', paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center' },
  bidButtonDisabled: { opacity: 0.5 },
  bidButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  watchButton: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center' },
  watchIcon: { fontSize: 14 },
  endedBanner: { marginTop: 16, padding: 16, backgroundColor: '#FFE0E0', borderRadius: 12, alignItems: 'center' },
  endedText: { fontSize: 16, fontWeight: '600', color: '#E17055', textAlign: 'center' },
  outcomeAction: { marginTop: 10, backgroundColor: '#6C5CE7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  outcomeActionText: { color: '#FFFFFF', fontWeight: '600' },
  confirmDetails: { marginBottom: 16, gap: 6 },
  confirmText: { color: '#666', fontSize: 14 },
  largeJumpWarning: { color: '#E17055', backgroundColor: '#FFE0E0', padding: 10, borderRadius: 8, fontWeight: '700', marginTop: 6 },
  historySection: { marginTop: 24 },
  historyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 },
  noBids: { fontSize: 14, color: '#999', textAlign: 'center', padding: 20 },
  bidItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 8 },
  bidderName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  bidTime: { fontSize: 12, color: '#999', marginTop: 2 },
  bidAmountContainer: { alignItems: 'flex-end' },
  bidAmount: { fontSize: 16, fontWeight: 'bold', color: '#6C5CE7' },
  winningText: { fontSize: 11, color: '#00B894', marginTop: 2 },
});