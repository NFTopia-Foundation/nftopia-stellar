import DataLoader from 'dataloader';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import { NftService } from '../../modules/nft/nft.service';

export function createNftLoader(
  nftService: NftService,
): DataLoader<string, Nft | null> {
  return new DataLoader<string, Nft | null>(async (ids) => {
    const nfts = await nftService.findByIds([...ids]);
    const nftById = new Map(nfts.map((nft) => [nft.id, nft]));

    return ids.map((id) => nftById.get(id) ?? null);
  });
}
