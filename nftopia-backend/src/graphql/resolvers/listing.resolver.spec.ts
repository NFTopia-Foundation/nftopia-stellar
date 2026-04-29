import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ListingResolver } from './listing.resolver';
import { ListingService } from '../../modules/listing/listing.service';
import { ListingStatus } from '../../modules/listing/interfaces/listing.interface';

const mockListingService = {
  findOne: jest.fn(),
  findConnection: jest.fn(),
  create: jest.fn(),
  cancel: jest.fn(),
  buy: jest.fn(),
};

describe('ListingResolver', () => {
  let resolver: ListingResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingResolver,
        { provide: ListingService, useValue: mockListingService },
      ],
    }).compile();

    resolver = module.get<ListingResolver>(ListingResolver);
    jest.clearAllMocks();
  });

  it('returns a single listing mapped to GraphQL shape', async () => {
    mockListingService.findOne.mockResolvedValue({
      id: 'listing-1',
      nftContractId: 'C'.repeat(56),
      nftTokenId: 'token-1',
      sellerId: 'seller-1',
      price: '10.2500000',
      currency: 'XLM',
      status: ListingStatus.ACTIVE,
      createdAt: new Date('2026-03-25T10:00:00.000Z'),
      expiresAt: null,
    });

    const result = await resolver.listing('listing-1');

    expect(mockListingService.findOne).toHaveBeenCalledWith('listing-1');
    expect(result.id).toBe('listing-1');
    expect(result.nftId).toBe(`${'C'.repeat(56)}:token-1`);
    expect(result.status).toBe(ListingStatus.ACTIVE);
  });

  it('builds a listing connection with pagination and filters', async () => {
    const createdAt = new Date('2026-03-25T10:00:00.000Z');
    mockListingService.findConnection.mockResolvedValue({
      data: [
        {
          id: 'listing-1',
          nftContractId: 'C'.repeat(56),
          nftTokenId: 'token-1',
          sellerId: 'seller-1',
          price: 2.5,
          currency: 'XLM',
          status: ListingStatus.ACTIVE,
          createdAt,
          expiresAt: null,
        },
      ],
      total: 1,
      hasNextPage: false,
    });

    const result = await resolver.listings(
      { first: 10 },
      {
        status: ListingStatus.ACTIVE,
        nftId: `${'C'.repeat(56)}:token-1`,
        sellerId: 'seller-1',
      },
    );

    expect(mockListingService.findConnection).toHaveBeenCalledWith({
      first: 10,
      after: undefined,
      status: ListingStatus.ACTIVE,
      sellerId: 'seller-1',
      nftContractId: 'C'.repeat(56),
      nftTokenId: 'token-1',
    });
    expect(result.totalCount).toBe(1);
    expect(result.pageInfo.hasNextPage).toBe(false);
    expect(result.edges[0]?.cursor).toEqual(expect.any(String));
  });

  it('passes decoded cursor into listing connection query', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: '2026-03-25T10:00:00.000Z',
        id: 'listing-1',
      }),
      'utf8',
    ).toString('base64url');

    mockListingService.findConnection.mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    });

    await resolver.listings({ first: 5, after: cursor });

    expect(mockListingService.findConnection).toHaveBeenCalledWith({
      first: 5,
      after: {
        createdAt: '2026-03-25T10:00:00.000Z',
        id: 'listing-1',
      },
      status: undefined,
      sellerId: undefined,
      nftContractId: undefined,
      nftTokenId: undefined,
    });
  });

  it('creates a listing for an authenticated user', async () => {
    mockListingService.create.mockResolvedValue({
      id: 'listing-1',
      nftContractId: 'C'.repeat(56),
      nftTokenId: 'token-1',
      sellerId: 'seller-1',
      price: 1,
      currency: 'XLM',
      status: ListingStatus.ACTIVE,
      createdAt: new Date('2026-03-25T10:00:00.000Z'),
      expiresAt: null,
    });

    await resolver.createListing(
      {
        nftId: `${'C'.repeat(56)}:token-1`,
        price: 1,
        currency: 'XLM',
      },
      {
        req: {} as never,
        res: {} as never,
        user: { userId: 'seller-1' },
      },
    );

    expect(mockListingService.create).toHaveBeenCalledWith(
      {
        nftContractId: 'C'.repeat(56),
        nftTokenId: 'token-1',
        price: 1,
        currency: 'XLM',
        expiresAt: undefined,
      },
      'seller-1',
    );
  });

  it('cancels listing and returns true for authenticated caller', async () => {
    mockListingService.cancel.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.CANCELLED,
    });

    const result = await resolver.cancelListing('listing-1', {
      req: {} as never,
      res: {} as never,
      user: { userId: 'seller-1' },
    });

    expect(result).toBe(true);
    expect(mockListingService.cancel).toHaveBeenCalledWith(
      'listing-1',
      'seller-1',
    );
  });

  it('buys NFT and maps transaction result', async () => {
    mockListingService.buy.mockResolvedValue({
      success: true,
      listingId: 'listing-1',
      buyer: 'buyer-1',
    });

    const result = await resolver.buyNFT('listing-1', {
      req: {} as never,
      res: {} as never,
      user: { userId: 'buyer-1' },
    });

    expect(result).toEqual({
      success: true,
      listingId: 'listing-1',
      buyerId: 'buyer-1',
    });
  });

  it('rejects unauthenticated listing mutation requests', async () => {
    await expect(
      resolver.createListing(
        {
          nftId: `${'C'.repeat(56)}:token-1`,
          price: 1,
        },
        {
          req: {} as never,
          res: {} as never,
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
