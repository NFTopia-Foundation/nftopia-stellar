import { AuctionBidPublisher } from './auction-bid.publisher';
import { AUCTION_BID_PLACED_TOPIC } from './topics';
import { BidSorobanStatus } from '../../modules/auction/entities/bid.entity';
import type { BidPlacedEvent } from '../../modules/bid/interfaces/bid.interface';

function makeEvent(overrides: Partial<BidPlacedEvent> = {}): BidPlacedEvent {
  return {
    bidId: 'bid-1',
    auctionId: 'auction-1',
    sellerId: 'seller-1',
    bidderId: 'bidder-1',
    stellarPublicKey: 'GABC',
    amount: 15,
    amountXlm: '15.0000000',
    sorobanStatus: BidSorobanStatus.CONFIRMED,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuctionBidPublisher (#650)', () => {
  it('publishes the bid-placed event onto the auctionBidPlaced topic, mapped to GraphqlBid shape', async () => {
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const publisher = new AuctionBidPublisher(pubSub as never);

    const event = makeEvent();
    await publisher.handleBidPlaced(event);

    expect(pubSub.publish).toHaveBeenCalledWith(AUCTION_BID_PLACED_TOPIC, {
      auctionBidPlaced: {
        id: event.bidId,
        auctionId: event.auctionId,
        bidderId: event.bidderId,
        amount: event.amountXlm,
        createdAt: event.timestamp,
      },
    });
  });

  it('publishes once per bid-placed event, regardless of which path emitted it', async () => {
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const publisher = new AuctionBidPublisher(pubSub as never);

    await publisher.handleBidPlaced(makeEvent({ auctionId: 'auction-A' }));
    await publisher.handleBidPlaced(makeEvent({ auctionId: 'auction-B' }));

    expect(pubSub.publish).toHaveBeenCalledTimes(2);
  });
});
