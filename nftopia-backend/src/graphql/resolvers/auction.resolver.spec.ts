import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuctionResolver } from './auction.resolver';
import { AuctionService } from '../../modules/auction/auction.service';
import { AuctionStatus } from '../../modules/auction/interfaces/auction.interface';

const mockAuctionService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  cancelAuction: jest.fn(),
  placeBid: jest.fn(),
};

const baseAuction = {
  id: 'auction-1',
  nftContractId: 'C'.repeat(56),
  nftTokenId: 'token-1',
  sellerId: 'seller-1',
  startPrice: 5.0,
  currentPrice: 5.0,
  reservePrice: undefined,
  startTime: new Date('2026-03-20T10:00:00.000Z'),
  endTime: new Date('2026-03-25T10:00:00.000Z'),
  status: AuctionStatus.ACTIVE,
  winnerId: undefined,
  createdAt: new Date('2026-03-20T10:00:00.000Z'),
  updatedAt: new Date('2026-03-20T10:00:00.000Z'),
};

describe('AuctionResolver', () => {
  let resolver: AuctionResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionResolver,
        { provide: AuctionService, useValue: mockAuctionService },
      ],
    }).compile();

    resolver = module.get<AuctionResolver>(AuctionResolver);
    jest.clearAllMocks();
  });

  it('returns a single auction by id', async () => {
    mockAuctionService.findOne.mockResolvedValue(baseAuction);

    const result = await resolver.auction('auction-1');

    expect(mockAuctionService.findOne).toHaveBeenCalledWith('auction-1');
    expect(result.id).toBe('auction-1');
    expect(result.status).toBe(AuctionStatus.ACTIVE);
  });

  it('returns an auction connection from findAll', async () => {
    mockAuctionService.findAll.mockResolvedValue([baseAuction]);

    const result = await resolver.auctions({ first: 5 }, { status: AuctionStatus.ACTIVE });

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.edges[0].cursor).toEqual(expect.any(String));
  });

  it('creates an auction for authenticated caller', async () => {
    mockAuctionService.create.mockResolvedValue(baseAuction);

    const result = await resolver.createAuction(
      {
        nftContractId: 'C'.repeat(56),
        nftTokenId: 'token-1',
        startPrice: 5.0,
        endTime: '2026-03-25T10:00:00.000Z',
      },
      { req: {} as never, res: {} as never, user: { userId: 'seller-1' } },
    );

    expect(mockAuctionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ startPrice: 5.0 }),
      'seller-1',
    );
    expect(result.sellerId).toBe('seller-1');
  });

  it('rejects createAuction when unauthenticated', async () => {
    await expect(
      resolver.createAuction(
        { nftContractId: 'C'.repeat(56), nftTokenId: 'token-1', startPrice: 5.0, endTime: '2026-03-25T10:00:00.000Z' },
        { req: {} as never, res: {} as never },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('places a bid and returns updated auction', async () => {
    mockAuctionService.placeBid.mockResolvedValue({});
    mockAuctionService.findOne.mockResolvedValue({
      ...baseAuction,
      currentPrice: 12.0,
    });

    const result = await resolver.placeBid(
      'auction-1',
      { amount: 12.0 },
      { req: {} as never, res: {} as never, user: { userId: 'bidder-1' } },
    );

    expect(mockAuctionService.placeBid).toHaveBeenCalledWith('auction-1', 'bidder-1', { amount: 12.0 });
    expect(result.currentPrice).toBe(12.0);
  });
});
