import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicCreatorResolver } from './public-creator.resolver';
import { CreatorNftSort } from '../types/public-creator.types';

describe('PublicCreatorResolver', () => {
  const mockUser = {
    id: 'creator-1',
    username: 'artist',
    bio: 'Creator bio',
    avatarUrl: 'https://cdn.example/avatar.png',
    bannerUrl: null,
    website: 'https://example.com',
    twitterHandle: '@artist',
    instagramHandle: null,
    isBanned: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const createResolver = (overrides?: {
    usersService?: Partial<Record<string, jest.Mock>>;
    followService?: Partial<Record<string, jest.Mock>>;
    nftService?: Partial<Record<string, jest.Mock>>;
    collectionService?: Partial<Record<string, jest.Mock>>;
    listingService?: Partial<Record<string, jest.Mock>>;
    orderService?: Partial<Record<string, jest.Mock>>;
  }) =>
    new PublicCreatorResolver(
      {
        findPublicCreator: jest.fn().mockResolvedValue(mockUser),
        findById: jest.fn().mockResolvedValue(mockUser),
        countNftsCreated: jest.fn().mockResolvedValue(3),
        getCreatorSalesVolume: jest.fn().mockResolvedValue('12.5000000'),
        isVerifiedCreator: jest.fn().mockResolvedValue(true),
        ...overrides?.usersService,
      } as never,
      {
        followerCount: jest.fn().mockResolvedValue(10),
        followingCount: jest.fn().mockResolvedValue(2),
        isFollowing: jest.fn().mockResolvedValue(false),
        follow: jest.fn().mockResolvedValue(true),
        unfollow: jest.fn().mockResolvedValue(true),
        ...overrides?.followService,
      } as never,
      {
        findConnection: jest.fn().mockResolvedValue({
          data: [],
          total: 0,
          hasNextPage: false,
        }),
        ...overrides?.nftService,
      } as never,
      {
        findConnection: jest.fn().mockResolvedValue({
          data: [],
          total: 0,
          hasNextPage: false,
        }),
        ...overrides?.collectionService,
      } as never,
      {
        findConnection: jest.fn().mockResolvedValue({
          data: [],
          total: 0,
          hasNextPage: false,
        }),
        ...overrides?.listingService,
      } as never,
      {
        findAllWithCount: jest.fn().mockResolvedValue({
          items: [],
          totalCount: 0,
          hasNextPage: false,
        }),
        ...overrides?.orderService,
      } as never,
    );

  it('returns a public creator profile', async () => {
    const resolver = createResolver();
    const result = await resolver.publicCreator('artist', {
      req: {} as never,
      res: {} as never,
      user: { userId: 'viewer-1' },
      loaders: {} as never,
    });

    expect(result.id).toBe('creator-1');
    expect(result.username).toBe('artist');
    expect(result.isVerified).toBe(true);
    expect(result.followerCount).toBe(10);
    expect(result.totalNftsCreated).toBe(3);
  });

  it('throws when creator is missing', async () => {
    const resolver = createResolver({
      usersService: {
        findPublicCreator: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      resolver.publicCreator('missing', {
        req: {} as never,
        res: {} as never,
        loaders: {} as never,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid identifiers', async () => {
    const resolver = createResolver();

    await expect(
      resolver.publicCreator('   ', {
        req: {} as never,
        res: {} as never,
        loaders: {} as never,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('follows a creator when authenticated', async () => {
    const resolver = createResolver();
    const result = await resolver.followCreator('creator-1', {
      req: {} as never,
      res: {} as never,
      user: { userId: 'viewer-1' },
      loaders: {} as never,
    });

    expect(result.success).toBe(true);
    expect(result.isFollowing).toBe(true);
    expect(result.followerCount).toBe(10);
  });

  it('loads creator nfts with sort filter', async () => {
    const nftService = {
      findConnection: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'nft-1',
            tokenId: '1',
            contractAddress: 'C1',
            name: 'Art',
            description: null,
            imageUrl: 'https://cdn.example/nft.png',
            attributes: [],
            ownerId: 'owner-1',
            creatorId: 'creator-1',
            collectionId: null,
            mintedAt: new Date('2024-02-01T00:00:00.000Z'),
            lastPrice: '5.0000000',
            createdAt: new Date('2024-02-01T00:00:00.000Z'),
          },
        ],
        total: 1,
        hasNextPage: false,
      }),
    };
    const resolver = createResolver({ nftService });

    const connection = await resolver.nfts(
      { id: 'creator-1' } as never,
      { first: 10 },
      CreatorNftSort.PRICE,
    );

    expect(nftService.findConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: 'creator-1',
        sortBy: 'PRICE',
      }),
    );
    expect(connection.totalCount).toBe(1);
    expect(connection.edges[0]?.node.id).toBe('nft-1');
  });
});
