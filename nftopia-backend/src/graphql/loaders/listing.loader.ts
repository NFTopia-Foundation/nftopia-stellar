import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { Listing } from '../../modules/listing/entities/listing.entity';

export function createListingByNftLoader(dataSource: DataSource) {
  return new DataLoader<string, Listing[]>(async (nftTokenIds) => {
    const listings = await dataSource.getRepository(Listing).find({
      where: { nftTokenId: In([...nftTokenIds]) },
    });
    const map = new Map<string, Listing[]>();
    for (const listing of listings) {
      const arr = map.get(listing.nftTokenId) ?? [];
      arr.push(listing);
      map.set(listing.nftTokenId, arr);
    }
    return nftTokenIds.map((id) => map.get(id) ?? []);
  });
}
