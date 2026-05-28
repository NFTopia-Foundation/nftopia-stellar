import DataLoader from 'dataloader';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { NftService } from '../../modules/nft/nft.service';

/**
 * DataLoader that resolves NFTs by composite contractAddress:tokenId key.
 * Used to resolve the `nft` field on Listing and Auction types.
 */
export function createNftByCompositeKeyLoader(
  nftService: NftService,
): DataLoader<string, Nft | null> {
  return new DataLoader<string, Nft | null>(async (compositeKeys) => {
    const unique = [...new Set(compositeKeys)] as string[];

    const parsed = unique
      .map((key) => {
        const colonIdx = key.indexOf(':');
        if (colonIdx < 1 || colonIdx === key.length - 1) {
          return null;
        }

        return {
          key,
          contractAddress: key.substring(0, colonIdx),
          tokenId: key.substring(colonIdx + 1),
        };
      })
      .filter(
        (
          value,
        ): value is {
          key: string;
          contractAddress: string;
          tokenId: string;
        } => value !== null,
      );

    if (!parsed.length) {
      return compositeKeys.map(() => null);
    }

    const nfts = await nftService.findByContractAddressAndTokenIds(
      parsed.map(({ contractAddress, tokenId }) => ({
        contractAddress,
        tokenId,
      })),
    );

    const nftMap = new Map<string, Nft>();
    for (const nft of nfts) {
      nftMap.set(`${nft.contractAddress}:${nft.tokenId}`, nft);
    }

    return compositeKeys.map((k) => nftMap.get(k) ?? null);
  });
}
