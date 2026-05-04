import DataLoader from 'dataloader';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import { ListingService } from '../../modules/listing/listing.service';
import { NftService } from '../../modules/nft/nft.service';
import type { Nft } from '../../modules/nft/entities/nft.entity';

function toCompositeNftId(contractAddress: string, tokenId: string): string {
  return `${contractAddress}:${tokenId}`;
}

export function createListingLoader(
  listingService: ListingService,
  nftService: NftService,
): DataLoader<string, Listing | null> {
  return new DataLoader<string, Listing | null>(async (nftIds) => {
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

    const listings = await listingService.findByNFTIds([...compositeNftIds]);
    const listingByCompositeId = new Map(
      listings.map((listing) => [
        toCompositeNftId(listing.nftContractId, listing.nftTokenId),
        listing,
      ]),
    );
    return nftIdList.map((nftId) => {
      if (nftId.includes(':')) {
        return listingByCompositeId.get(nftId) ?? null;
      }

      const nft = nftById.get(nftId);
      if (!nft) {
        return null;
      }

      const compositeId = toCompositeNftId(nft.contractAddress, nft.tokenId);
      return listingByCompositeId.get(compositeId) ?? null;
    });
  });
}
