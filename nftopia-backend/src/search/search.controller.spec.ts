import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

const mockSearchService = {
  search: jest.fn().mockResolvedValue({
    nfts: { hits: [], estimatedTotalHits: 0 },
    users: { hits: [], estimatedTotalHits: 0 },
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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /search?q=... should return 200 and structure with hits', async () => {
    const result = await controller.search({
      q: 'test query',
      type: 'all',
      limit: 20,
      offset: 0,
    });
    expect(mockSearchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'test query', type: 'all', limit: 20, offset: 0 }),
    );
    expect(result).toHaveProperty('nfts');
    expect(result).toHaveProperty('users');
    expect(result.nfts).toHaveProperty('hits');
    expect(Array.isArray(result.nfts?.hits)).toBe(true);
    expect(result.users).toHaveProperty('hits');
    expect(Array.isArray(result.users?.hits)).toBe(true);
  });
});
