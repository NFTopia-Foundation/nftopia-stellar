import DataLoader from 'dataloader';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import { AuctionService } from '../../modules/auction/auction.service';
import { NftService } from '../../modules/nft/nft.service';
import type { Nft } from '../../modules/nft/entities/nft.entity';

function toCompositeNftId(contractAddress: string, tokenId: string): string {
  return `${contractAddress}:${tokenId}`;
}

export function createAuctionLoader(
  auctionService: AuctionService,
  nftService: NftService,
): DataLoader<string, Auction | null> {
  return new DataLoader<string, Auction | null>(async (nftIds) => {
    const nftIdList = [...nftIds];
    const compositeNftIds = new Set<string>();
    const uuidNftIds: string[] = [];

    for (const nftId of nftIdList) {
      if (nftId.includes(':')) {
        compositeNftIds.add(nftId);
      } else {
        uuidNftIds.push(nftId);
      }
    }

    let nftById = new Map<string, Nft>();
    if (uuidNftIds.length) {
      const nfts = await nftService.findByIds(uuidNftIds);
      nftById = new Map(nfts.map((nft) => [nft.id, nft]));
      for (const nft of nfts) {
        compositeNftIds.add(toCompositeNftId(nft.contractAddress, nft.tokenId));
      }
    }

    const auctions = await auctionService.findByNFTIds([...compositeNftIds]);
    const auctionByCompositeId = new Map(
      auctions.map((auction) => [
        toCompositeNftId(auction.nftContractId, auction.nftTokenId),
        auction,
      ]),
    );

    return nftIdList.map((nftId) => {
      if (nftId.includes(':')) {
        return auctionByCompositeId.get(nftId) ?? null;
      }

      const nft = nftById.get(nftId);
      if (!nft) {
        return null;
      }

      const compositeId = toCompositeNftId(nft.contractAddress, nft.tokenId);
      return auctionByCompositeId.get(compositeId) ?? null;
    });
  });
}
