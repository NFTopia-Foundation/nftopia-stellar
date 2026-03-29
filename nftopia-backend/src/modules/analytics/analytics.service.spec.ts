import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service.js';
import { CollectionStats } from './entities/collection-stats.entity.js';
import { Order } from '../order/entities/order.entity.js';
import { Nft } from '../nft/entities/nft.entity.js';
import { Listing } from '../listing/entities/listing.entity.js';

const mockQueryBuilder = {
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orUpdate: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawOne: jest.fn().mockResolvedValue({ floorPrice: null }),
  getMany: jest.fn().mockResolvedValue([]),
  execute: jest.fn().mockResolvedValue({}),
};

const mockRepo = () => ({
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(CollectionStats), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: getRepositoryToken(Nft), useFactory: mockRepo },
        { provide: getRepositoryToken(Listing), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCollectionStats', () => {
    it('returns empty stats and charts when no data exists', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);

      const result = await service.getCollectionStats('col-1');

      expect(result.stats).toEqual([]);
      expect(result.charts.volume).toEqual([]);
      expect(result.charts.floorPrice).toEqual([]);
    });

    it('maps stats rows to chart [timestamp, value] pairs', async () => {
      const row: Partial<CollectionStats> = {
        collectionId: 'col-1',
        date: '2026-03-25',
        volume: '500.0000000',
        floorPrice: '10.0000000',
        salesCount: 5,
      };
      mockQueryBuilder.getMany.mockResolvedValueOnce([row]);

      const result = await service.getCollectionStats('col-1');

      expect(result.stats).toHaveLength(1);
      expect(result.charts.volume[0][1]).toBe('500.0000000');
      expect(result.charts.floorPrice[0][1]).toBe('10.0000000');
      expect(typeof result.charts.volume[0][0]).toBe('number');
    });

    it('applies from/to date filters', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);

      await service.getCollectionStats('col-1', '2026-03-01', '2026-03-25');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'stats.date >= :from',
        { from: '2026-03-01' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'stats.date <= :to',
        { to: '2026-03-25' },
      );
    });
  });

  describe('aggregateDailyStats', () => {
    it('does nothing when no collections had sales yesterday', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.aggregateDailyStats();

      expect(mockQueryBuilder.execute).not.toHaveBeenCalled();
    });

    it('upserts a row for each collection with sales', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { collectionId: 'col-1', volume: '200.0000000', salesCount: '3' },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ floorPrice: '15.0000000' });

      await service.aggregateDailyStats();

      expect(mockQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionId: 'col-1',
          volume: '200.0000000',
          salesCount: 3,
          floorPrice: '15.0000000',
        }),
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('sets floorPrice to null when no active listings exist', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { collectionId: 'col-2', volume: '50.0000000', salesCount: '1' },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ floorPrice: null });

      await service.aggregateDailyStats();

      expect(mockQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ floorPrice: null }),
      );
    });
  });
});
