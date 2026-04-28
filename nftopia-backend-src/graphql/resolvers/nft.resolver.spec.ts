import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NftResolver } from './nft.resolver';
import { NftService } from '../../modules/nft/nft.service';

const mockNftService = {
  findById: jest.fn(),
  findConnection: jest.fn(),
  mint: jest.fn(),
  update: jest.fn(),
};

describe('NftResolver', () => {
  let resolver: NftResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NftResolver,
        { provide: NftService, useValue: mockNftService },
      ],
    }).compile();

    resolver = module.get<NftResolver>(NftResolver);
    jest.clearAllMocks();
  });

  it('returns a single NFT mapped to the GraphQL shape', async () => {
    mockNftService.findById.mockResolvedValue({
      id: 'nft-1',
      tokenId: 'token-1',
      contractAddress: 'C'.repeat(56),
      name: 'Genesis',
      description: 'First drop',
      imageUrl: 'https://example.com/nft.png',
      ownerId: 'owner-1',
      creatorId: 'creator-1',
      collectionId: 'collection-1',
      mintedAt: new Date('2026-03-20T10:00:00.000Z'),
      lastPrice: '12.5000000',
      attributes: [{ traitType: 'Rarity', value: 'Legendary' }],
    });

    const result = await resolver.nft('nft-1');

    expect(result.image).toBe('https://example.com/nft.png');
    expect(result.attributes).toEqual([
      { traitType: 'Rarity', value: 'Legendary' },
    ]);
    expect(mockNftService.findById).toHaveBeenCalledWith('nft-1');
  });

  it('builds a connection response for paginated NFTs', async () => {
    const createdAt = new Date('2026-03-20T10:00:00.000Z');
    mockNftService.findConnection.mockResolvedValue({
      data: [
        {
          id: 'nft-1',
          tokenId: 'token-1',
          contractAddress: 'C'.repeat(56),
          name: 'Genesis',
          ownerId: 'owner-1',
          creatorId: 'creator-1',
          mintedAt: createdAt,
          createdAt,
          attributes: [],
        },
      ],
      total: 42,
      hasNextPage: true,
    });

    const result = await resolver.nfts({ first: 10 }, { search: 'genesis' });

    expect(mockNftService.findConnection).toHaveBeenCalledWith({
      first: 10,
      after: undefined,
      ownerId: undefined,
      creatorId: undefined,
      collectionId: undefined,
      search: 'genesis',
      includeBurned: undefined,
    });
    expect(result.totalCount).toBe(42);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].cursor).toEqual(expect.any(String));
  });

  it('passes a decoded cursor into the service for owner queries', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: '2026-03-20T10:00:00.000Z',
        id: 'nft-1',
      }),
      'utf8',
    ).toString('base64url');
    mockNftService.findConnection.mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    });

    await resolver.nftsByOwner('owner-1', { first: 5, after: cursor });

    expect(mockNftService.findConnection).toHaveBeenCalledWith({
      first: 5,
      after: {
        createdAt: '2026-03-20T10:00:00.000Z',
        id: 'nft-1',
      },
      ownerId: 'owner-1',
    });
  });

  it('mints an NFT for an authenticated user', async () => {
    mockNftService.mint.mockResolvedValue({
      id: 'nft-1',
      tokenId: 'token-1',
      contractAddress: 'C'.repeat(56),
      name: 'Genesis',
      ownerId: 'owner-1',
      creatorId: 'owner-1',
      mintedAt: new Date('2026-03-20T10:00:00.000Z'),
      attributes: [],
    });

    await resolver.mintNFT(
      {
        tokenId: 'token-1',
        contractAddress: 'C'.repeat(56),
        name: 'Genesis',
        image: 'https://example.com/nft.png',
        ownerId: 'owner-1',
        creatorId: 'owner-1',
      },
      {
        req: {} as never,
        res: {} as never,
        user: { userId: 'owner-1' },
      },
    );

    expect(mockNftService.mint).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: 'https://example.com/nft.png' }),
      'owner-1',
    );
  });

  it('rejects unauthenticated metadata updates', async () => {
    await expect(
      resolver.updateNFTMetadata(
        'nft-1',
        { name: 'Updated' },
        {
          req: {} as never,
          res: {} as never,
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
