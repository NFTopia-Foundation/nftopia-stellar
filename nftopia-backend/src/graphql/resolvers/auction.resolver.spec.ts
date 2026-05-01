import { AuctionResolver } from './auction.resolver';

describe('AuctionResolver', () => {
  it('maps an auction query response', async () => {
    const auctionService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'a1',
        nftContractId: 'C'.repeat(56),
        nftTokenId: '1',
        sellerId: 'seller-1',
        startPrice: 1,
        currentPrice: 2,
        reservePrice: 3,
        startTime: new Date('2026-03-20T10:00:00.000Z'),
        endTime: new Date('2026-03-21T10:00:00.000Z'),
        status: 'ACTIVE',
        winnerId: null,
      }),
    };

    const resolver = new AuctionResolver(auctionService as never);
    const result = await resolver.auction('a1');

    expect(auctionService.findOne).toHaveBeenCalledWith('a1');
    expect(result.nftId).toBe(`${'C'.repeat(56)}:1`);
    expect(result.currentPrice).toBe('2.0000000');
  });

  it('resolves bids via DataLoader', async () => {
    const resolver = new AuctionResolver({ findOne: jest.fn() } as never);
    const result = await resolver.bids(
      {
        id: 'a1',
        nftId: `${'C'.repeat(56)}:1`,
        sellerId: 'seller-1',
        startPrice: '1.0000000',
        currentPrice: '2.0000000',
        reservePrice: null,
        startTime: new Date('2026-03-20T10:00:00.000Z'),
        endTime: new Date('2026-03-21T10:00:00.000Z'),
        status: 'ACTIVE' as never,
      },
      {
        req: {} as never,
        res: {} as never,
        loaders: {
          bidsByAuctionId: {
            load: jest.fn().mockResolvedValue([
              {
                id: 'b1',
                auctionId: 'a1',
                bidderId: 'u1',
                amount: 1.5,
                createdAt: new Date('2026-03-20T11:00:00.000Z'),
              },
            ]),
          },
        } as never,
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'b1',
        auctionId: 'a1',
        bidderId: 'u1',
        amount: '1.5000000',
      }),
    ]);
  });
});
