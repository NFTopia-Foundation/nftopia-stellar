import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SearchService, MEILI_CLIENT } from './search.service';
import { StellarNft } from '../nft/entities/stellar-nft.entity';
import { NftMetadata } from '../nft/entities/nft-metadata.entity';
const createMockIndex = () => ({
  addDocuments: jest.fn().mockResolvedValue({ taskUid: 1 }),
  search: jest.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
  updateSettings: jest.fn().mockResolvedValue(undefined),
});

describe('SearchService', () => {
  let service: SearchService;
  let mockClient: { index: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    const nftIndex = createMockIndex();
    const userIndex = createMockIndex();
    mockClient = {
      index: jest.fn((name: string) => (name === 'nfts' ? nftIndex : userIndex)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'MEILI_HOST' ? 'http://localhost:7700' : undefined)) },
        },
        {
          provide: MEILI_CLIENT,
          useValue: mockClient,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('indexNft', () => {
    it('should send correct payload to addDocuments', async () => {
      const metadata = new NftMetadata();
      metadata.id = 'meta-uuid';
      metadata.name = 'Test NFT';
      metadata.description = 'A test description';
      metadata.image = 'https://example.com/img.png';
      metadata.attributes = [{ trait_type: 'Background', value: 'Blue' }];

      const nft = new StellarNft();
      nft.contractId = 'C123';
      nft.tokenId = '1';
      nft.owner = 'GABC';
      nft.views = 10;
      nft.volume = 100.5;
      nft.mintedAt = new Date('2024-01-15');
      nft.metadata = metadata;

      await service.indexNft(nft);

      const index = mockClient.index('nfts');
      expect(index.addDocuments).toHaveBeenCalledTimes(1);
      const [docs] = (index.addDocuments as jest.Mock).mock.calls[0];
      expect(docs).toHaveLength(1);
      const doc = docs[0];
      expect(doc.id).toBe('C123:1');
      expect(doc.name).toBe('Test NFT');
      expect(doc.description).toBe('A test description');
      expect(doc.contractId).toBe('C123');
      expect(doc.tokenId).toBe('1');
      expect(doc.owner).toBe('GABC');
      expect(doc.attributes).toEqual([{ trait_type: 'Background', value: 'Blue' }]);
      expect(doc.views).toBe(10);
      expect(doc.volume).toBe(100.5);
      expect(doc.mintedAt).toBe(new Date('2024-01-15').getTime());
    });
  });

  describe('search', () => {
    it('should call index.search with expected params for type nfts', async () => {
      const nftIndex = mockClient.index('nfts') as ReturnType<typeof createMockIndex>;
      (nftIndex.search as jest.Mock).mockResolvedValue({ hits: [{ id: 'C:1' }], estimatedTotalHits: 1 });

      const result = await service.search({
        q: 'test',
        type: 'nfts',
        contractId: 'C123',
        limit: 10,
        offset: 0,
      });

      expect(nftIndex.search).toHaveBeenCalledWith('test', expect.objectContaining({
        filter: 'contractId = "C123"',
        limit: 10,
        offset: 0,
      }));
      expect(result.nfts?.hits).toHaveLength(1);
      expect(result.nfts?.estimatedTotalHits).toBe(1);
    });

    it('should return structure with hits for GET /search', async () => {
      const result = await service.search({ q: 'foo', type: 'all' });
      expect(result).toHaveProperty('nfts');
      expect(result).toHaveProperty('users');
      expect(result.nfts).toHaveProperty('hits');
      expect(Array.isArray(result.nfts?.hits)).toBe(true);
      expect(result.users).toHaveProperty('hits');
      expect(Array.isArray(result.users?.hits)).toBe(true);
    });
  });
});
