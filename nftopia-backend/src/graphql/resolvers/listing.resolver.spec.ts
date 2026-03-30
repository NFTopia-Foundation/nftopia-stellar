import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ListingResolver } from './listing.resolver';
import { ListingService } from '../../modules/listing/listing.service';
import { ListingStatus } from '../../modules/listing/interfaces/listing.interface';

const mockListingService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  cancel: jest.fn(),
};

const baseListing = {
  id: 'listing-1',
  nftContractId: 'C'.repeat(56),
  nftTokenId: 'token-1',
  sellerId: 'seller-1',
  price: 10.5,
  currency: 'XLM',
  status: 'ACTIVE',
  expiresAt: undefined,
  createdAt: new Date('2026-03-20T10:00:00.000Z'),
  updatedAt: new Date('2026-03-20T10:00:00.000Z'),
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

  it('returns a single listing by id', async () => {
    mockListingService.findOne.mockResolvedValue(baseListing);

    const result = await resolver.listing('listing-1');

    expect(mockListingService.findOne).toHaveBeenCalledWith('listing-1');
    expect(result.id).toBe('listing-1');
    expect(result.status).toBe(ListingStatus.ACTIVE);
    expect(result.price).toBe(10.5);
  });

  it('returns a listing connection from findAll', async () => {
    mockListingService.findAll.mockResolvedValue([baseListing]);

    const result = await resolver.listings({ first: 10 }, { status: ListingStatus.ACTIVE });

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.edges[0].node.id).toBe('listing-1');
    expect(result.edges[0].cursor).toEqual(expect.any(String));
  });

  it('creates a listing for authenticated caller', async () => {
    mockListingService.create.mockResolvedValue(baseListing);

    const result = await resolver.createListing(
      { nftContractId: 'C'.repeat(56), nftTokenId: 'token-1', price: 10.5 },
      { req: {} as never, res: {} as never, user: { userId: 'seller-1' } },
    );

    expect(mockListingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 10.5 }),
      'seller-1',
    );
    expect(result.sellerId).toBe('seller-1');
  });

  it('rejects createListing when unauthenticated', async () => {
    await expect(
      resolver.createListing(
        { nftContractId: 'C'.repeat(56), nftTokenId: 'token-1', price: 10.5 },
        { req: {} as never, res: {} as never },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('cancels a listing for authenticated caller', async () => {
    mockListingService.cancel.mockResolvedValue({
      ...baseListing,
      status: 'CANCELLED',
    });

    const result = await resolver.cancelListing('listing-1', {
      req: {} as never,
      res: {} as never,
      user: { userId: 'seller-1' },
    });

    expect(mockListingService.cancel).toHaveBeenCalledWith('listing-1', 'seller-1');
    expect(result.status).toBe(ListingStatus.CANCELLED);
  });
});
