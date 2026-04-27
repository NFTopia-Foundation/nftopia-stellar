import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../analytics.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionStats } from '../../collection/entities/collection-stats.entity';
import { Order } from '../../order/entities/order.entity';
import { Repository } from 'typeorm';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let statsRepo: Repository<CollectionStats>;
  let orderRepo: Repository<Order>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(CollectionStats),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Order),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    statsRepo = module.get<Repository<CollectionStats>>(
      getRepositoryToken(CollectionStats),
    );
    orderRepo = module.get<Repository<Order>>(getRepositoryToken(Order));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should aggregate stats for a date', async () => {
    // Use correct types to avoid lint warnings

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          collectionId: 'col1',
          volume: '100',
          floorPrice: '10',
          salesCount: 5,
        },
      ]),
    } as unknown as import('typeorm').SelectQueryBuilder<Order>;
    jest
      .spyOn(orderRepo, 'createQueryBuilder')
      .mockReturnValue(mockQueryBuilder);
    const saveSpy = jest
      .spyOn(statsRepo, 'save')
      .mockResolvedValue(
        {} as import('../../collection/entities/collection-stats.entity').CollectionStats,
      );
    await service.aggregateStatsForDate('2026-04-25');
    expect(saveSpy).toHaveBeenCalledWith({
      collectionId: 'col1',
      date: '2026-04-25',
      volume: '100',
      floorPrice: '10',
      salesCount: 5,
    });
  });
});
