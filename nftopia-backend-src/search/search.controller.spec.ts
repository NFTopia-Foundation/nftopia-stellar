import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

const mockSearchService = {
  search: jest.fn().mockResolvedValue({
    query: 'rare',
    type: 'all',
    page: 1,
    limit: 20,
    nfts: {
      hits: [],
      estimatedTotalHits: 0,
      page: 1,
      hitsPerPage: 20,
      totalPages: 0,
    },
  }),
};

describe('SearchController', () => {
  let controller: SearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    jest.clearAllMocks();
  });

  it('proxies search requests to the service', async () => {
    const query = { q: 'rare', type: 'nfts' as const, limit: 10 };

    await controller.search(query);

    expect(mockSearchService.search).toHaveBeenCalledWith(query);
  });
});
