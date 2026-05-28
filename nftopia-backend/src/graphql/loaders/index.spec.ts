import { createAuctionLoader } from './auction.loader';
import { createBidLoader } from './bid.loader';
import { createCollectionLoader } from './collection.loader';
import { createListingLoader } from './listing.loader';
import { createNftLoader } from './nft.loader';
import { createOrderLoader } from './order.loader';
import { createUserLoader } from './user.loader';

describe('GraphQL DataLoaders', () => {
  it('batches users by IDs and preserves key order', async () => {
    const usersService = {
      findByIds: jest.fn().mockResolvedValue([{ id: 'u2' }, { id: 'u1' }]),
    };

    const loader = createUserLoader(usersService as never);
    const values = await loader.loadMany(['u1', 'u2', 'missing']);

    expect(usersService.findByIds).toHaveBeenCalledWith([
      'u1',
      'u2',
      'missing',
    ]);
    expect(values).toEqual([{ id: 'u1' }, { id: 'u2' }, null]);
  });

  it('batches NFTs by IDs and maps missing entries to null', async () => {
    const nftService = {
      findByIds: jest.fn().mockResolvedValue([{ id: 'n1' }]),
    };

    const loader = createNftLoader(nftService as never);
    const values = await loader.loadMany(['n1', 'n2']);

    expect(values).toEqual([{ id: 'n1' }, null]);
  });

  it('batches collections by IDs', async () => {
    const collectionService = {
      findByIds: jest.fn().mockResolvedValue([{ id: 'c1' }]),
    };

    const loader = createCollectionLoader(collectionService as never);
    const values = await loader.loadMany(['c1', 'c2']);

    expect(values).toEqual([{ id: 'c1' }, null]);
  });

  it('loads listings by NFT UUID using NFT mapping to contract:token', async () => {
    const listingService = {
      findByNFTIds: jest.fn().mockResolvedValue([
        {
          id: 'l1',
          nftContractId: 'contract-1',
          nftTokenId: 'token-1',
        },
      ]),
    };
    const nftService = {
      findByIds: jest
        .fn()
        .mockResolvedValue([
          { id: 'n1', contractAddress: 'contract-1', tokenId: 'token-1' },
        ]),
    };

    const loader = createListingLoader(
      listingService as never,
      nftService as never,
    );
    const listing = await loader.load('n1');

    expect(listingService.findByNFTIds).toHaveBeenCalledWith([
      'contract-1:token-1',
    ]);
    expect(listing).toEqual(
      expect.objectContaining({
        id: 'l1',
        nftContractId: 'contract-1',
        nftTokenId: 'token-1',
      }),
    );
  });

  it('loads auctions by NFT UUID using NFT mapping to contract:token', async () => {
    const auctionService = {
      findByNFTIds: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          nftContractId: 'contract-1',
          nftTokenId: 'token-1',
        },
      ]),
    };
    const nftService = {
      findByIds: jest
        .fn()
        .mockResolvedValue([
          { id: 'n1', contractAddress: 'contract-1', tokenId: 'token-1' },
        ]),
    };

    const loader = createAuctionLoader(
      auctionService as never,
      nftService as never,
    );
    const auction = await loader.load('n1');

    expect(auctionService.findByNFTIds).toHaveBeenCalledWith([
      'contract-1:token-1',
    ]);
    expect(auction).toEqual(
      expect.objectContaining({
        id: 'a1',
        nftContractId: 'contract-1',
        nftTokenId: 'token-1',
      }),
    );
  });

  it('groups bids by auction ID', async () => {
    const bidService = {
      findByAuctionIds: jest.fn().mockResolvedValue([
        { id: 'b1', auctionId: 'a1' },
        { id: 'b2', auctionId: 'a1' },
        { id: 'b3', auctionId: 'a2' },
      ]),
    };

    const loader = createBidLoader(bidService as never);
    const values = await loader.loadMany(['a1', 'a2', 'a3']);

    expect(values).toEqual([
      [
        { id: 'b1', auctionId: 'a1' },
        { id: 'b2', auctionId: 'a1' },
      ],
      [{ id: 'b3', auctionId: 'a2' }],
      [],
    ]);
  });

  it('groups orders by NFT ID', async () => {
    const orderService = {
      findByNFTIds: jest.fn().mockResolvedValue([
        { id: 'o1', nftId: 'n1' },
        { id: 'o2', nftId: 'n2' },
      ]),
    };

    const loader = createOrderLoader(orderService as never);
    const values = await loader.loadMany(['n1', 'n2', 'n3']);

    expect(values).toEqual([
      [{ id: 'o1', nftId: 'n1' }],
      [{ id: 'o2', nftId: 'n2' }],
      [],
    ]);
  });
});
