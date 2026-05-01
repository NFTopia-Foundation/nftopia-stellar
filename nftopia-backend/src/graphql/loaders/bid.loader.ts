import DataLoader from 'dataloader';
import type { Bid } from '../../modules/auction/entities/bid.entity';
import { BidService } from '../../modules/bid/bid.service';

export function createBidLoader(
  bidService: BidService,
): DataLoader<string, Bid[]> {
  return new DataLoader<string, Bid[]>(async (auctionIds) => {
    const bids = await bidService.findByAuctionIds([...auctionIds]);
    const bidsByAuctionId = new Map<string, Bid[]>();

    for (const bid of bids) {
      const current = bidsByAuctionId.get(bid.auctionId) ?? [];
      current.push(bid);
      bidsByAuctionId.set(bid.auctionId, current);
    }

    return auctionIds.map((auctionId) => bidsByAuctionId.get(auctionId) ?? []);
  });
}
