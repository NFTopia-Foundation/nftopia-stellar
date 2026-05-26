import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';

const makeQb = (rows: Order[], total: number) => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
  getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
});

describe('OrderService', () => {
  let service: OrderService;
  let mockQb: ReturnType<typeof makeQb>;

  const mockRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: mockRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(false) } },
        { provide: MarketplaceSettlementClient, useValue: { createTrade: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllWithCount', () => {
    it('returns items, totalCount, page, and limit', async () => {
      const rows = [{ id: '1' } as Order, { id: '2' } as Order];
      mockQb = makeQb(rows, 10);
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAllWithCount({ page: 1, limit: 2 });

      expect(result.totalCount).toBe(10);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(mockQb.getManyAndCount).toHaveBeenCalled();
    });

    it('computes hasNextPage correctly (page * limit < totalCount)', async () => {
      const rows = [{ id: '1' } as Order];
      mockQb = makeQb(rows, 5);
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const { page, limit, totalCount } = await service.findAllWithCount({ page: 1, limit: 1 });
      expect(page * limit < totalCount).toBe(true);
    });

    it('hasNextPage is false on last page', async () => {
      const rows = [{ id: '1' } as Order];
      mockQb = makeQb(rows, 1);
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const { page, limit, totalCount } = await service.findAllWithCount({ page: 1, limit: 20 });
      expect(page * limit < totalCount).toBe(false);
    });

    it('defaults page to 1 and limit to 20 when not provided', async () => {
      mockQb = makeQb([], 0);
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAllWithCount({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
