import { Test, TestingModule } from '@nestjs/testing';
import { OrderResolver } from './order.resolver';
import { OrderService } from '../../modules/order/order.service';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { Request, Response } from 'express';

const makeOrder = (overrides = {}) => ({
  id: '1',
  nftId: 'nft1',
  buyerId: 'b1',
  sellerId: 's1',
  price: '10',
  currency: 'XLM',
  type: 'SALE',
  status: 'COMPLETED',
  transactionHash: 'tx',
  createdAt: new Date(),
  ...overrides,
});

const makePagedResult = (items: ReturnType<typeof makeOrder>[], totalCount = items.length, page = 1, limit = 20) => ({
  items,
  totalCount,
  page,
  limit,
});

describe('OrderResolver', () => {
  let resolver: OrderResolver;
  let service: jest.Mocked<Pick<OrderService, 'findOne' | 'findAll' | 'findAllWithCount' | 'getSalesAnalytics'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderResolver,
        {
          provide: OrderService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn(),
            findAllWithCount: jest.fn(),
            getSalesAnalytics: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<OrderResolver>(OrderResolver);
    service = module.get(OrderService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('order', () => {
    it('should fetch a single order by ID', async () => {
      const mockOrder = makeOrder();
      (service.findOne as jest.Mock).mockResolvedValue(mockOrder);
      const result = await resolver.order('1');
      expect(result.id).toBe('1');
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('myOrders', () => {
    const ctx = {
      req: {} as unknown as Request,
      res: {} as unknown as Response,
      loaders: {} as never,
      user: { userId: 'u1' },
    };

    it('should return hasNextPage: true when more pages exist', async () => {
      const orders = Array.from({ length: 2 }, (_, i) => makeOrder({ id: String(i) }));
      (service.findAllWithCount as jest.Mock).mockResolvedValue(makePagedResult(orders, 5, 1, 2));
      const result = await resolver.myOrders({ first: 2, after: '1' }, 'SALE', ctx);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.totalCount).toBe(5);
    });

    it('should return hasNextPage: false on last page', async () => {
      const orders = [makeOrder()];
      (service.findAllWithCount as jest.Mock).mockResolvedValue(makePagedResult(orders, 1, 1, 20));
      const result = await resolver.myOrders({}, 'SALE', ctx);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should fetch PURCHASE orders for current user', async () => {
      const orders = [makeOrder({ buyerId: 'u1', type: 'PURCHASE' })];
      (service.findAllWithCount as jest.Mock).mockResolvedValue(makePagedResult(orders, 1, 1, 20));
      const result = await resolver.myOrders({}, 'PURCHASE', ctx);
      expect(result.edges[0].node.buyerId).toBe('u1');
    });
  });

  describe('userOrders', () => {
    it('should fetch orders for a specific user with correct pagination', async () => {
      const orders = [makeOrder({ buyerId: 'u2', type: 'PURCHASE' })];
      (service.findAllWithCount as jest.Mock).mockResolvedValue(makePagedResult(orders, 1, 1, 20));
      const result = await resolver.userOrders('u2', {});
      expect(result.edges[0].node.buyerId).toBe('u2');
      expect(result.totalCount).toBe(1);
    });

    it('should return hasNextPage: true when more pages exist', async () => {
      const orders = Array.from({ length: 5 }, (_, i) => makeOrder({ id: String(i) }));
      (service.findAllWithCount as jest.Mock).mockResolvedValue(makePagedResult(orders, 12, 1, 5));
      const result = await resolver.userOrders('u2', { first: 5, after: '1' });
      expect(result.pageInfo.hasNextPage).toBe(true);
    });
  });

  describe('nftOrders', () => {
    it('should fetch order history for NFT', async () => {
      const mockOrders = [makeOrder({ nftId: 'nft1' })];
      (service.findAll as jest.Mock).mockResolvedValue(mockOrders);
      const result = await resolver.nftOrders('nft1');
      expect(result[0].nftId).toBe('nft1');
    });
  });

  describe('salesAnalytics', () => {
    it('should fetch sales analytics', async () => {
      const mockStats = { volume: '100', count: 5, averagePrice: '20' };
      (service.getSalesAnalytics as jest.Mock).mockReturnValue(mockStats);
      const timeframe = { periodStart: '2024-01-01', periodEnd: '2024-01-31' };
      const result = await resolver.salesAnalytics(timeframe);
      expect(result.totalVolume).toBe('100');
      expect(result.totalSales).toBe(5);
      expect(result.averagePrice).toBe('20');
    });
  });
});
