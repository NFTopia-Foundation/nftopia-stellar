import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { OrderType, OrderStatus } from './dto/create-order.dto';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: jest.Mocked<Repository<Order>>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    };
    const mockSettlementClient = {
      createTrade: jest.fn(),
      createBundle: jest.fn(),
    };

    const mockRepository = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MarketplaceSettlementClient,
          useValue: mockSettlementClient,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSalesAnalytics', () => {
    it('should return analytics for completed sales within timeframe', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-12-31');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          volume: '1000.50',
          count: '10',
          averagePrice: '100.05',
        }),
      };

      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSalesAnalytics(periodStart, periodEnd);

      expect(result).toEqual({
        volume: '1000.50',
        count: 10,
        averagePrice: '100.05',
      });

      expect(orderRepository.createQueryBuilder).toHaveBeenCalledWith('order');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('order.type = :type', {
        type: OrderType.SALE,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'order.status = :status',
        { status: OrderStatus.COMPLETED },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'order.createdAt BETWEEN :periodStart AND :periodEnd',
        { periodStart, periodEnd },
      );
    });

    it('should return zero values when no orders match criteria', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-12-31');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSalesAnalytics(periodStart, periodEnd);

      expect(result).toEqual({
        volume: '0',
        count: 0,
        averagePrice: '0',
      });
    });

    it('should handle null values from database', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-12-31');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          volume: null,
          count: null,
          averagePrice: null,
        }),
      };

      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSalesAnalytics(periodStart, periodEnd);

      expect(result).toEqual({
        volume: '0',
        count: 0,
        averagePrice: '0',
      });
    });

    it('should filter only SALE type and COMPLETED status', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-12-31');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          volume: '500.00',
          count: '5',
          averagePrice: '100.00',
        }),
      };

      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.getSalesAnalytics(periodStart, periodEnd);

      const whereCalls = mockQueryBuilder.where.mock.calls;
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;

      expect(whereCalls[0]).toEqual(['order.type = :type', { type: OrderType.SALE }]);
      expect(andWhereCalls[0]).toEqual(['order.status = :status', { status: OrderStatus.COMPLETED }]);
    });
  });
});
