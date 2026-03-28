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
});
