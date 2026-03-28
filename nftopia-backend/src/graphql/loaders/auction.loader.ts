import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { Auction } from '../../modules/auction/entities/auction.entity';
import { AuctionStatus } from '../../modules/auction/interfaces/auction.interface';

export function createAuctionByNftLoader(dataSource: DataSource) {
  return new DataLoader<string, Auction[]>(async (nftTokenIds) => {
    const auctions = await dataSource.getRepository(Auction).find({
      where: { nftTokenId: In([...nftTokenIds]), status: AuctionStatus.ACTIVE },
    });
    const map = new Map<string, Auction[]>();
    for (const auction of auctions) {
      const arr = map.get(auction.nftTokenId) ?? [];
      arr.push(auction);
      map.set(auction.nftTokenId, arr);
    }
    return nftTokenIds.map((id) => map.get(id) ?? []);
  });
}
