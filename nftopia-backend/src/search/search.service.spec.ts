import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { SEARCH_CLIENT } from './search.constants';

const mockNftIndex = {
  addDocuments: jest.fn(),
  deleteDocument: jest.fn(),
  search: jest.fn(),
  updateSearchableAttributes: jest.fn(),
  updateFilterableAttributes: jest.fn(),
  updateSortableAttributes: jest.fn(),
};

const mockProfileIndex = {
  addDocuments: jest.fn(),
  search: jest.fn(),
  updateSearchableAttributes: jest.fn(),
  updateSortableAttributes: jest.fn(),
};

const mockClient = {
  index: jest.fn((name: string) => {
    if (name === 'nfts') {
      return mockNftIndex;
    }

    return mockProfileIndex;
  }),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: SEARCH_CLIENT,
          useValue: mockClient,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
    mockNftIndex.search.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      facetDistribution: {},
    });
    mockProfileIndex.search.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
    });
  });

  it('indexes nft documents with flattened trait facets', async () => {
    await service.indexNft({
      id: 'nft-1',
      tokenId: 'token-1',
      contractAddress: 'C'.repeat(56),
      name: 'Nebula Ape',
      description: 'Rare ape',
      imageUrl: 'https://example.com/ape.png',
      animationUrl: null,
      externalUrl: null,
      ownerId: '11111111-1111-1111-1111-111111111111',
      creatorId: '22222222-2222-2222-2222-222222222222',
      collectionId: '33333333-3333-3333-3333-333333333333',
      lastPrice: '12.5',
      isBurned: false,
      mintedAt: new Date('2026-03-26T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T01:00:00.000Z'),
      attributes: [
        {
          traitType: 'Rarity',
          value: 'Legendary',
          displayType: 'string',
        },
      ],
    } as never);

    expect(mockNftIndex.addDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'nft-1',
        name: 'Nebula Ape',
        entityType: 'nft',
        attributeFacets: ['Rarity:Legendary'],
        attributes: [
          {
            traitType: 'Rarity',
            value: 'Legendary',
            displayType: 'string',
          },
        ],
      }),
    ]);
  });

  it('builds filtered nft searches with sort and facets', async () => {
    await service.search({
      q: 'nebula',
      type: 'nfts',
      page: 2,
      limit: 5,
      collectionId: '33333333-3333-3333-3333-333333333333',
      traitType: 'Rarity',
      traitValue: 'Legendary',
      sort: 'lastPrice:desc',
    });

    expect(mockNftIndex.search).toHaveBeenCalledWith('nebula', {
      page: 2,
      hitsPerPage: 5,
      filter: [
        'isBurned = false',
        'collectionId = "33333333-3333-3333-3333-333333333333"',
        'attributeFacets = "Rarity:Legendary"',
      ],
      sort: ['lastPrice:desc'],
      facets: ['collectionId', 'ownerId', 'creatorId', 'attributeFacets'],
    });
  });

  it('uses empty query defaults when called with no params', async () => {
    const result = await service.search({});

    expect(result.query).toBe('');
    expect(result.type).toBe('all');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);

    expect(mockNftIndex.search).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        page: 1,
        hitsPerPage: 20,
      }),
    );
    expect(mockProfileIndex.search).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        page: 1,
        hitsPerPage: 20,
      }),
    );
  });

  it('includes ownerId filter when ownerId is provided', async () => {
    await service.search({
      q: 'ape',
      type: 'nfts',
      ownerId: '11111111-1111-1111-1111-111111111111',
    });

    expect(mockNftIndex.search).toHaveBeenCalledWith(
      'ape',
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filter: expect.arrayContaining([
          'ownerId = "11111111-1111-1111-1111-111111111111"',
        ]),
      }),
    );
  });

  it('includes creatorId filter when creatorId is provided', async () => {
    await service.search({
      q: 'ape',
      type: 'nfts',
      creatorId: '22222222-2222-2222-2222-222222222222',
    });

    expect(mockNftIndex.search).toHaveBeenCalledWith(
      'ape',
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filter: expect.arrayContaining([
          'creatorId = "22222222-2222-2222-2222-222222222222"',
        ]),
      }),
    );
  });

  it('combines collectionId, ownerId, and trait filters', async () => {
    await service.search({
      q: 'rare',
      type: 'nfts',
      collectionId: '33333333-3333-3333-3333-333333333333',
      ownerId: '11111111-1111-1111-1111-111111111111',
      traitType: 'Background',
      traitValue: 'Blue',
    });

    expect(mockNftIndex.search).toHaveBeenCalledWith(
      'rare',
      expect.objectContaining({
        filter: [
          'isBurned = false',
          'collectionId = "33333333-3333-3333-3333-333333333333"',
          'ownerId = "11111111-1111-1111-1111-111111111111"',
          'attributeFacets = "Background:Blue"',
        ],
      }),
    );
  });

  it('queries only profile index when type is profiles', async () => {
    await service.search({ q: 'alice', type: 'profiles' });

    expect(mockProfileIndex.search).toHaveBeenCalledWith(
      'alice',
      expect.any(Object),
    );
    expect(mockNftIndex.search).not.toHaveBeenCalled();
  });

  it('queries only nft index when type is nfts', async () => {
    await service.search({ q: 'nebula', type: 'nfts' });

    expect(mockNftIndex.search).toHaveBeenCalledWith(
      'nebula',
      expect.any(Object),
    );
    expect(mockProfileIndex.search).not.toHaveBeenCalled();
  });

  it('falls back to createdAt:desc when username sort is used on nft index', async () => {
    await service.search({
      q: 'test',
      type: 'nfts',
      sort: 'username:asc',
    });

    expect(mockNftIndex.search).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        sort: ['createdAt:desc'],
      }),
    );
  });

  it('removes an nft document by id', async () => {
    await service.removeNft('nft-42');

    expect(mockNftIndex.deleteDocument).toHaveBeenCalledWith('nft-42');
  });

  it('indexes a user as a profile document', async () => {
    await service.indexUser({
      id: 'user-1',
      address: 'GABCDEF',
      username: 'alice',
      bio: 'NFT collector',
      avatarUrl: 'https://example.com/avatar.png',
      walletAddress: 'GABCDEF',
      walletPublicKey: 'GABCDEF',
      walletProvider: 'freighter',
    } as never);

    expect(mockProfileIndex.addDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'user-1',
        username: 'alice',
        bio: 'NFT collector',
        entityType: 'profile',
      }),
    ]);
  });
});
