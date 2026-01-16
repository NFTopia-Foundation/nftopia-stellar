import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NFT } from '../nfts/entities/nft.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';

describe('StatsService', () => {
  let service: StatsService;

  let mockNFTRepository: Partial<Repository<NFT>>;
  let mockTransactionRepository: Partial<Repository<Transaction>>;
  let mockUserRepository: Partial<Repository<User>>;

  // mock results
  const popularNFTs = [{ id: 'nft-1', salesCount: 10 }];
  const topSellers = [{ sellerId: 'user-1', totalSales: 100 }];
  const categoryNFTs = [
    {
      id: 'nft-2',
      tokenId: '2',
      title: 'Art NFT',
      description: 'Sample',
      imageUrl: '',
      ipfsUrl: '',
      metadata: { category: 'Art' },
      price: 2.0,
      currency: 'STK',
      isListed: true,
      owner: {} as User,
      collection: null,
      category: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // mock query builder
  const mockQueryBuilder: Partial<SelectQueryBuilder<any>> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(popularNFTs),
    getMany: jest.fn().mockResolvedValue(categoryNFTs),
  };

  beforeEach(async () => {
    mockNFTRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockTransactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockUserRepository = {
      // not used directly, just injected
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: getRepositoryToken(NFT), useValue: mockNFTRepository },
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  it('should return popular NFTs this week', async () => {
    const result = await service.getPopularThisWeek();
    expect(mockTransactionRepository.createQueryBuilder).toHaveBeenCalledWith('transaction');
    expect(result).toEqual(popularNFTs);
  });

  it('should return top sellers', async () => {
    // override getRawMany for this case
    (mockQueryBuilder.getRawMany as jest.Mock).mockResolvedValueOnce(topSellers);
    const result = await service.getTopSellers();
    expect(mockTransactionRepository.createQueryBuilder).toHaveBeenCalledWith('transaction');
    expect(result).toEqual(topSellers);
  });

  it('should return NFTs by category', async () => {
    const result = await service.getNFTsByCategory('Art');
    expect(mockNFTRepository.createQueryBuilder).toHaveBeenCalledWith('nft');
    expect(result).toEqual(categoryNFTs);
  });
});
