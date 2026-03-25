import { Test, TestingModule } from '@nestjs/testing';
import { ListingService } from '../../marketplace/listing.service';
import { ListingResolver } from './listing.resolver';
import { ListingStatus } from '../types/listing.types';

describe('ListingResolver', () => {
  let resolver: ListingResolver;

  const listingServiceMock: Record<string, jest.Mock> = {
    findById: jest.fn(),
    findListings: jest.fn(),
    createListing: jest.fn(),
    cancelListing: jest.fn(),
    buyNft: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingResolver,
        {
          provide: ListingService,
          useValue: listingServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<ListingResolver>(ListingResolver);
    jest.clearAllMocks();
  });

  it('should return single listing', async () => {
    listingServiceMock.findById.mockResolvedValue({
      id: 'l1',
      nftId: 'n1',
      sellerId: 'u1',
      price: '10.0000000',
      currency: 'XLM',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: null,
    });

    const listing = await resolver.listing('l1');

    expect(listing?.id).toBe('l1');
    expect(listingServiceMock.findById).toHaveBeenCalledWith('l1');
  });

  it('should query paginated listings with filter', async () => {
    listingServiceMock.findListings.mockResolvedValue({
      items: [
        {
          id: 'l1',
          nftId: 'n1',
          sellerId: 'u1',
          price: '10.0000000',
          currency: 'XLM',
          status: 'ACTIVE',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: null,
        },
      ],
      totalCount: 1,
      hasNextPage: false,
      endCursor: 'l1',
    });

    const result = await resolver.listings(
      { status: ListingStatus.ACTIVE, nftId: 'n1', sellerId: 'u1' },
      { limit: 10, offset: 0 },
    );

    expect(result.totalCount).toBe(1);
    expect(result.edges[0].node.id).toBe('l1');
  });

  it('should create listing from authenticated user', async () => {
    listingServiceMock.createListing.mockResolvedValue({
      id: 'l2',
      nftId: 'n2',
      sellerId: 'user-123',
      price: '22.0000000',
      currency: 'XLM',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: null,
    });

    const result = await resolver.createListing(
      {
        nftId: 'n2',
        price: '22.0000000',
        currency: 'XLM',
      },
      { user: { userId: 'user-123' } },
    );

    expect(result.sellerId).toBe('user-123');
    expect(listingServiceMock.createListing).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 'user-123', nftId: 'n2' }),
    );
  });

  it('should cancel listing', async () => {
    listingServiceMock.cancelListing.mockResolvedValue(true);

    const result = await resolver.cancelListing('l3', {
      user: { userId: 'user-123' },
    });

    expect(result).toBe(true);
    expect(listingServiceMock.cancelListing).toHaveBeenCalledWith(
      'l3',
      'user-123',
    );
  });

  it('should buy NFT and return transaction result', async () => {
    listingServiceMock.buyNft.mockResolvedValue({
      success: true,
      txHash: 'mock_tx_l4',
      message: 'Purchase completed',
    });

    const result = await resolver.buyNFT('l4', {
      user: { userId: 'buyer-123' },
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_tx_l4');
    expect(listingServiceMock.buyNft).toHaveBeenCalledWith('l4', 'buyer-123');
  });
});
