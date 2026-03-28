import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { Bid } from '../../modules/auction/entities/bid.entity';

export function createBidByAuctionLoader(dataSource: DataSource) {
  return new DataLoader<string, Bid[]>(async (auctionIds) => {
    const bids = await dataSource.getRepository(Bid).find({
      where: { auctionId: In([...auctionIds]) },
      order: { createdAt: 'DESC' },
    });
    const map = new Map<string, Bid[]>();
    for (const bid of bids) {
      const arr = map.get(bid.auctionId) ?? [];
      arr.push(bid);
      map.set(bid.auctionId, arr);
    }
    return auctionIds.map((id) => map.get(id) ?? []);
  });
}
