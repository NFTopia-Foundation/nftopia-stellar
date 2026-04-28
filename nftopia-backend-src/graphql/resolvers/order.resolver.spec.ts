import { Test, TestingModule } from '@nestjs/testing';
import { OrderResolver } from './order.resolver';
import { OrderService } from '../../modules/order/order.service';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { Request, Response } from 'express';

describe('OrderResolver', () => {
  let resolver: OrderResolver;
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderResolver,
        {
          provide: OrderService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn(),
            getSalesAnalytics: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<OrderResolver>(OrderResolver);
    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('order', () => {
    it('should fetch a single order by ID', async () => {
      const mockOrder = {
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
      };
      (service.findOne as jest.Mock).mockResolvedValue(mockOrder);
      const result = await resolver.order('1');
      expect(result.id).toBe('1');
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('myOrders', () => {
    it('should fetch current user orders', async () => {
      const mockOrders = [
        {
          id: '1',
          nftId: 'nft1',
          buyerId: 'u1',
          sellerId: 's1',
          price: '10',
          currency: 'XLM',
          type: 'SALE',
          status: 'COMPLETED',
          transactionHash: 'tx',
          createdAt: new Date(),
        },
      ];
      (service.findAll as jest.Mock).mockResolvedValue(mockOrders);
      const result = await resolver.myOrders({}, 'SALE', {
        req: {} as unknown as Request,
        res: {} as unknown as Response,
        user: { userId: 'u1' },
      });
      expect(result.edges[0].node.id).toBe('1');
    });
  });

  describe('userOrders', () => {
    it('should fetch orders for a specific user', async () => {
      const mockOrders = [
        {
          id: '1',
          nftId: 'nft1',
          buyerId: 'u2',
          sellerId: 's1',
          price: '10',
          currency: 'XLM',
          type: 'PURCHASE',
          status: 'COMPLETED',
          transactionHash: 'tx',
          createdAt: new Date(),
        },
      ];
      (service.findAll as jest.Mock).mockResolvedValue(mockOrders);
      const result = await resolver.userOrders('u2', {});
      expect(result.edges[0].node.buyerId).toBe('u2');
    });
  });

  describe('nftOrders', () => {
    it('should fetch order history for NFT', async () => {
      const mockOrders = [
        {
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
        },
      ];
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
