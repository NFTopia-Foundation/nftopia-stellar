import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import AuctionDetailScreen, { deriveAuctionOutcome, shouldPollAuction } from '../AuctionDetailScreen';
import type { Auction, Bid } from '@/types';

const placeBid = jest.fn();
const fetchAuctionById = jest.fn();
const fetchBidHistory = jest.fn();

let auctionStoreState: any;
let authStoreState: any;
let walletStoreState: any;

jest.mock('@/stores/auctionStore', () => ({
  useAuctionStore: () => auctionStoreState,
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector(authStoreState),
}));

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: (selector: (state: any) => unknown) => selector(walletStoreState),
}));

jest.mock('@/lib/api/sample', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/src/services/stellar/wallet.service', () => ({
  StellarWalletService: jest.fn().mockImplementation(() => ({
    estimateFee: jest.fn().mockResolvedValue({ totalFeeXlm: '0.0002', tiers: { medium: { feePerOperationXlm: '0.0002' } } }),
  })),
}));

jest.mock('@/components/wallet/ConfirmationDialog', () => ({
  __esModule: true,
  default: ({ visible, children, onConfirm, onCancel, confirmDisabled }: any) =>
    visible ? React.createElement('RNConfirmationDialog', {
      children,
      onConfirm,
      onCancel,
      confirmDisabled,
    }) : null,
}));

const baseAuction: Auction = {
  id: 'auction-1', nftId: 'nft-1', nftName: 'Moon NFT', nftImage: 'https://example.com/nft.png',
  creatorId: 'seller-1', creatorName: 'Seller', creatorAvatar: '', startPrice: '10', currentPrice: '20', reservePrice: '15',
  currency: 'XLM', startTime: '2026-01-01T00:00:00Z', endTime: '2026-01-01T01:00:00Z', status: 'ended', bidCount: 2, isWatched: false,
};

const bid = (bidderId: string, amount: string, isWinning = true): Bid => ({
  id: `${bidderId}-${amount}`, auctionId: 'auction-1', bidderId, bidderName: bidderId, bidderAvatar: '', amount, currency: 'XLM', timestamp: '2026-01-01T00:30:00Z', isWinning,
});

function textNodes(root: ReactTestInstance): string[] {
  return root.findAll((node) => String(node.type) === 'RNText').map((node) => node.children.join(''));
}

function findButton(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  return root.findAll((node) => String(node.type) === 'RNTouchableOpacity').find((node) =>
    node.findAll((child) => String(child.type) === 'RNText' && child.children.join('') === label).length > 0,
  );
}

describe('AuctionDetailScreen settlement and bid confirmation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    auctionStoreState = {
      currentAuction: { ...baseAuction, status: 'active', endTime: '2099-01-01T00:00:00Z' },
      bidHistory: [bid('buyer-1', '20')], loading: false, placeBid, fetchAuctionById, fetchBidHistory,
      toggleWatch: jest.fn(), watchedAuctions: [],
    };
    authStoreState = { user: { id: 'buyer-1' } };
    walletStoreState = { network: 'testnet' };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('derives won, lost, reserve-not-met, seller, and awaiting outcomes', () => {
    expect(deriveAuctionOutcome({ ...baseAuction, status: 'settled' }, [bid('buyer-1', '20')], 'buyer-1')).toBe('won');
    expect(deriveAuctionOutcome({ ...baseAuction, status: 'settled' }, [bid('buyer-2', '20')], 'buyer-1')).toBe('lost');
    expect(deriveAuctionOutcome({ ...baseAuction, status: 'settled', reservePrice: '50' }, [bid('buyer-1', '20')], 'buyer-1')).toBe('reserve_not_met');
    expect(deriveAuctionOutcome({ ...baseAuction, status: 'settled' }, [bid('buyer-2', '20')], 'seller-1')).toBe('seller_sold');
    expect(deriveAuctionOutcome({ ...baseAuction, status: 'settled', reservePrice: '50' }, [], 'seller-1')).toBe('seller_unsold');
    expect(deriveAuctionOutcome(baseAuction, [], 'buyer-1')).toBe('reserve_not_met');
  });

  it('polls active auctions and stops for settled or cancelled auctions', () => {
    expect(shouldPollAuction({ ...baseAuction, status: 'active' })).toBe(true);
    expect(shouldPollAuction({ ...baseAuction, status: 'ended' })).toBe(true);
    expect(shouldPollAuction({ ...baseAuction, status: 'settled' })).toBe(false);
    expect(shouldPollAuction({ ...baseAuction, status: 'cancelled' })).toBe(false);
  });

  it('opens, confirms, and cancels bid confirmation', async () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<AuctionDetailScreen route={{ params: { auctionId: 'auction-1' } }} navigation={{ navigate: jest.fn() }} />); });

    const input = renderer.root.find((node) => String(node.type) === 'RNTextInput');
    act(() => input.props.onChangeText('21'));
    act(() => {
      findButton(renderer.root, 'Place Bid')?.props.onPress();
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'RNConfirmationDialog')).toHaveLength(1);
    const dialog = renderer.root.find((node) => String(node.type) === 'RNConfirmationDialog');
    expect(textNodes(dialog).join(' ')).toContain('Bid amount');

    await act(async () => {
      await dialog.props.onConfirm();
    });
    expect(placeBid).toHaveBeenCalledWith('auction-1', '21');
  });

  it('cancels bid confirmation without placing a bid', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<AuctionDetailScreen route={{ params: { auctionId: 'auction-1' } }} navigation={{ navigate: jest.fn() }} />); });

    const input = renderer.root.find((node) => String(node.type) === 'RNTextInput');
    act(() => input.props.onChangeText('21'));
    act(() => findButton(renderer.root, 'Place Bid')?.props.onPress());
    const dialog = renderer.root.find((node) => String(node.type) === 'RNConfirmationDialog');

    act(() => dialog.props.onCancel());
    expect(placeBid).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => String(node.type) === 'RNConfirmationDialog')).toHaveLength(0);
  });

  it('shows a prominent warning for bids more than 5x the current price', () => {
    auctionStoreState.currentAuction = { ...auctionStoreState.currentAuction, currentPrice: '10' };
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<AuctionDetailScreen route={{ params: { auctionId: 'auction-1' } }} navigation={{ navigate: jest.fn() }} />); });

    const input = renderer.root.find((node) => String(node.type) === 'RNTextInput');
    act(() => input.props.onChangeText('51'));
    act(() => findButton(renderer.root, 'Place Bid')?.props.onPress());

    const dialog = renderer.root.find((node) => String(node.type) === 'RNConfirmationDialog');
    expect(textNodes(dialog).join(' ')).toContain('more than 5x');
  });
});
