import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CollectionResolver } from './collection.resolver';
import { CollectionService } from '../../modules/collection/collection.service';
import { NftService } from '../../modules/nft/nft.service';

const mockCollectionService = {
  findById: jest.fn(),
  findConnection: jest.fn(),
  findTopCollections: jest.fn(),
  getStats: jest.fn(),
  create: jest.fn(),
};

const mockNftService = {
  findConnection: jest.fn(),
};

describe('CollectionResolver', () => {
  let resolver: CollectionResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionResolver,
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: NftService, useValue: mockNftService },
      ],
    }).compile();

    resolver = module.get<CollectionResolver>(CollectionResolver);
    jest.clearAllMocks();
  });

  it('returns a single collection mapped to the GraphQL shape', async () => {
    mockCollectionService.findById.mockResolvedValue({
      id: 'collection-1',
      contractAddress: 'C'.repeat(56),
      name: 'NFTopia Genesis',
      symbol: 'NFTG',
      description: 'Genesis drop',
      imageUrl: 'https://example.com/collection.png',
      creatorId: 'creator-1',
      totalVolume: '25.5000000',
      floorPrice: '1.2500000',
      totalSupply: 12,
      createdAt: new Date('2026-03-24T10:00:00.000Z'),
    });

    const result = await resolver.collection('collection-1');

    expect(result.image).toBe('https://example.com/collection.png');
    expect(result.totalVolume).toBe('25.5000000');
    expect(mockCollectionService.findById).toHaveBeenCalledWith('collection-1');
  });

  it('builds a connection response for paginated collections', async () => {
    const createdAt = new Date('2026-03-24T10:00:00.000Z');
    mockCollectionService.findConnection.mockResolvedValue({
      data: [
        {
          id: 'collection-1',
          contractAddress: 'C'.repeat(56),
          name: 'NFTopia Genesis',
          symbol: 'NFTG',
          imageUrl: 'https://example.com/collection.png',
          creatorId: 'creator-1',
          totalVolume: '25.5000000',
          floorPrice: '1.2500000',
          totalSupply: 12,
          createdAt,
        },
      ],
      total: 18,
      hasNextPage: true,
    });

    const result = await resolver.collections(
      { first: 10 },
      { search: 'genesis', verifiedOnly: true },
    );

    expect(mockCollectionService.findConnection).toHaveBeenCalledWith({
      first: 10,
      after: undefined,
      creatorId: undefined,
      search: 'genesis',
      verifiedOnly: true,
    });
    expect(result.totalCount).toBe(18);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.edges[0].cursor).toEqual(expect.any(String));
  });

  it('passes decoded cursor into the service for collection pagination', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: '2026-03-24T10:00:00.000Z',
        id: 'collection-1',
      }),
      'utf8',
    ).toString('base64url');

    mockCollectionService.findConnection.mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    });

    await resolver.collections({ first: 5, after: cursor }, undefined);

    expect(mockCollectionService.findConnection).toHaveBeenCalledWith({
      first: 5,
      after: {
        createdAt: '2026-03-24T10:00:00.000Z',
        id: 'collection-1',
      },
      creatorId: undefined,
      search: undefined,
      verifiedOnly: undefined,
    });
  });

  it('returns top collections sorted by volume from the service', async () => {
    mockCollectionService.findTopCollections.mockResolvedValue([
      {
        id: 'collection-1',
        contractAddress: 'C'.repeat(56),
        name: 'NFTopia Genesis',
        symbol: 'NFTG',
        imageUrl: 'https://example.com/collection.png',
        creatorId: 'creator-1',
        totalVolume: '30.0000000',
        floorPrice: '2.0000000',
        totalSupply: 12,
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
      },
    ]);

    const result = await resolver.topCollections(5);

    expect(result).toHaveLength(1);
    expect(mockCollectionService.findTopCollections).toHaveBeenCalledWith(5);
  });

  it('returns collection statistics from the service', async () => {
    mockCollectionService.getStats.mockResolvedValue({
      totalVolume: '30.0000000',
      floorPrice: '2.0000000',
      totalSupply: 12,
      ownerCount: 7,
    });

    const result = await resolver.collectionStats('collection-1');

    expect(result.ownerCount).toBe(7);
    expect(mockCollectionService.getStats).toHaveBeenCalledWith('collection-1');
  });

  it('resolves collection NFTs through the NFT connection service', async () => {
    const createdAt = new Date('2026-03-24T10:00:00.000Z');
    mockNftService.findConnection.mockResolvedValue({
      data: [
        {
          id: 'nft-1',
          tokenId: 'token-1',
          contractAddress: 'C'.repeat(56),
          name: 'Genesis #1',
          ownerId: 'owner-1',
          creatorId: 'creator-1',
          collectionId: 'collection-1',
          mintedAt: createdAt,
          createdAt,
          attributes: [],
        },
      ],
      total: 1,
      hasNextPage: false,
    });

    const result = await resolver.nfts(
      {
        id: 'collection-1',
        contractAddress: 'C'.repeat(56),
        name: 'NFTopia Genesis',
        symbol: 'NFTG',
        image: 'https://example.com/collection.png',
        creatorId: 'creator-1',
        totalVolume: '0.0000000',
        floorPrice: '0.0000000',
        totalSupply: 1,
        createdAt,
      },
      { first: 5 },
      { search: 'genesis' },
    );

    expect(mockNftService.findConnection).toHaveBeenCalledWith({
      first: 5,
      after: undefined,
      ownerId: undefined,
      creatorId: undefined,
      collectionId: 'collection-1',
      search: 'genesis',
      includeBurned: undefined,
    });
    expect(result.totalCount).toBe(1);
    expect(result.edges[0]?.node.collectionId).toBe('collection-1');
  });

  it('creates a collection for an authenticated user', async () => {
    mockCollectionService.create.mockResolvedValue({
      id: 'collection-1',
      contractAddress: 'C'.repeat(56),
      name: 'NFTopia Genesis',
      symbol: 'NFTG',
      imageUrl: 'https://example.com/collection.png',
      creatorId: 'creator-1',
      totalVolume: '0.0000000',
      floorPrice: null,
      totalSupply: 0,
      createdAt: new Date('2026-03-24T10:00:00.000Z'),
    });

    await resolver.createCollection(
      {
        contractAddress: 'C'.repeat(56),
        name: 'NFTopia Genesis',
        symbol: 'NFTG',
        image: 'https://example.com/collection.png',
      },
      {
        req: {} as never,
        res: {} as never,
        user: { userId: 'creator-1' },
      },
    );

    expect(mockCollectionService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://example.com/collection.png',
      }),
      'creator-1',
    );
  });

  it('rejects unauthenticated collection creation', async () => {
    await expect(
      resolver.createCollection(
        {
          contractAddress: 'C'.repeat(56),
          name: 'NFTopia Genesis',
          symbol: 'NFTG',
          image: 'https://example.com/collection.png',
        },
        {
          req: {} as never,
          res: {} as never,
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
