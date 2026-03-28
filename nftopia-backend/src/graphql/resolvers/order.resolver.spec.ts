import { Test, TestingModule } from '@nestjs/testing';
import { OrderResolver } from './order.resolver';
import { OrderService } from '../../modules/order/order.service';
import { OrderStatus, OrderType } from '../../modules/order/dto/create-order.dto';

const mockOrderService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  getStats: jest.fn(),
};

const baseOrder = {
  id: 'order-1',
  nftId: 'nft-1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  price: '10.5000000',
  currency: 'XLM',
  type: OrderType.SALE,
  status: OrderStatus.COMPLETED,
  transactionHash: 'abc123',
  listingId: 'listing-1',
  auctionId: undefined,
  createdAt: new Date('2026-03-20T10:00:00.000Z'),
};

describe('OrderResolver', () => {
  let resolver: OrderResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderResolver,
        { provide: OrderService, useValue: mockOrderService },
      ],
    }).compile();

    resolver = module.get<OrderResolver>(OrderResolver);
    jest.clearAllMocks();
  });

  it('returns a single order by id', async () => {
    mockOrderService.findOne.mockResolvedValue(baseOrder);

    const result = await resolver.order('order-1');

    expect(mockOrderService.findOne).toHaveBeenCalledWith('order-1');
    expect(result.id).toBe('order-1');
    expect(result.type).toBe(OrderType.SALE);
    expect(result.status).toBe(OrderStatus.COMPLETED);
  });

  it('returns an order connection from findAll', async () => {
    mockOrderService.findAll.mockResolvedValue([baseOrder]);

    const result = await resolver.orders({ first: 10 }, { buyerId: 'buyer-1' });

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.edges[0].cursor).toEqual(expect.any(String));
  });

  it('returns order stats for an NFT', async () => {
    mockOrderService.getStats.mockResolvedValue({
      volume: '105.0000000',
      count: 10,
      averagePrice: '10.5000000',
    });

    const result = await resolver.orderStats('nft-1');

    expect(mockOrderService.getStats).toHaveBeenCalledWith('nft-1');
    expect(result.count).toBe(10);
    expect(result.volume).toBe('105.0000000');
  });
});
