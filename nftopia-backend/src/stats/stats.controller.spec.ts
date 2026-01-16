import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { NFT } from '../nfts/entities/nft.entity';
import { User } from '../users/entities/user.entity';

describe('StatsController', () => {
  let controller: StatsController;
  let service: StatsService;

  const mockNFTs: NFT[] = [
    {
      id: 'nft-1',
      tokenId: '1',
      title: 'Mock NFT',
      description: 'A test NFT',
      imageUrl: 'http://example.com/image.png',
      ipfsUrl: '',
      metadata: {},
      price: 1.5,
      currency: 'STK',
      isListed: true,
      owner: {} as User,
      collection: null,
      category: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockUsers: User[] = [
    {
      id: 'user-1',
      walletAddress: '0x123',
      username: 'artist1',
      avatar: '',
      isArtist: true,
      nfts: [],
      collections: [],
      auctions: [],
      bids: [],
      purchases: [],
      sales: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockStatsService = {
    getPopularThisWeek: jest.fn().mockResolvedValue(mockNFTs),
    getTopSellers: jest.fn().mockResolvedValue(mockUsers),
    getNFTsByCategory: jest.fn().mockResolvedValue(mockNFTs),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        {
          provide: StatsService,
          useValue: mockStatsService,
        },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
    service = module.get<StatsService>(StatsService);
  });

  it('should return popular NFTs this week', async () => {
    const result = await controller.getPopularThisWeek();
    expect(result).toEqual(mockNFTs);
    expect(service.getPopularThisWeek).toHaveBeenCalled();
  });

  it('should return top sellers', async () => {
    const result = await controller.getTopSellers();
    expect(result).toEqual(mockUsers);
    expect(service.getTopSellers).toHaveBeenCalled();
  });

  it('should return NFTs by category', async () => {
    const category = 'Art';
    const result = await controller.getNFTsByCategory(category);
    expect(result).toEqual(mockNFTs);
    expect(service.getNFTsByCategory).toHaveBeenCalledWith(category);
  });
});
