import DataLoader from 'dataloader';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { AuctionService } from '../../modules/auction/auction.service';

/**
 * DataLoader that resolves Auctions by their UUID primary key.
 * Used to resolve the `auction` field on Bid types.
 */
export function createAuctionByIdLoader(
  auctionService: AuctionService,
): DataLoader<string, Auction | null> {
  return new DataLoader<string, Auction | null>(async (ids) => {
    const auctions = await auctionService.findByIds([...ids]);
    const map = new Map<string, Auction>(auctions.map((a) => [a.id, a]));
    return ids.map((id) => map.get(id) ?? null);
  });
}
