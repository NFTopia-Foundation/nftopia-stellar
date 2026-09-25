import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  buildMarketplaceTools,
  MARKETPLACE_TOOL_NAMES,
} from './marketplace.tools';
import type { RunnableToolLike } from './tool-set.types';
import { OrderStatus, OrderType } from '../../order/dto/create-order.dto';

describe('marketplace.tools — order tools (#488)', () => {
  const orderService = {
    findAllForUser: jest.fn(),
    findOneForUser: jest.fn(),
  };

  const otherDeps = {
    nftService: {} as never,
    listingService: {} as never,
    collectionService: {} as never,
    auctionService: {} as never,
  };

  const getTool = (name: string, userId = 'user-1'): RunnableToolLike => {
    const tools = buildMarketplaceTools({
      ...otherDeps,
      orderService: orderService as never,
      userId,
    });
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool "${name}" not found`);
    return tool;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes search_orders and get_order in MARKETPLACE_TOOL_NAMES', () => {
    expect(MARKETPLACE_TOOL_NAMES).toContain('search_orders');
    expect(MARKETPLACE_TOOL_NAMES).toContain('get_order');
  });

  describe('search_orders', () => {
    it("strips any buyerId/sellerId/userId the model tries to supply — they aren't part of the schema, so they never reach run()", () => {
      const tool = getTool('search_orders');

      const parsed = tool.parse({
        buyerId: 'someone-else',
        sellerId: 'someone-else',
        userId: 'someone-else',
        status: OrderStatus.COMPLETED,
      }) as Record<string, unknown>;

      expect(parsed).not.toHaveProperty('buyerId');
      expect(parsed).not.toHaveProperty('sellerId');
      expect(parsed).not.toHaveProperty('userId');
      expect(parsed.status).toBe(OrderStatus.COMPLETED);
    });

    it('always scopes the query to the userId the tool was built with, regardless of input', async () => {
      orderService.findAllForUser.mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        limit: 20,
        hasNextPage: false,
      });

      await getTool('search_orders', 'the-real-caller').run({
        status: OrderStatus.COMPLETED,
      });

      expect(orderService.findAllForUser).toHaveBeenCalledWith(
        'the-real-caller',
        expect.objectContaining({ status: OrderStatus.COMPLETED }),
        expect.anything(),
      );
    });

    it('forwards filters and pagination to OrderService.findAllForUser', async () => {
      orderService.findAllForUser.mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 2,
        limit: 5,
        hasNextPage: false,
      });

      await getTool('search_orders').run({
        nftId: '123e4567-e89b-12d3-a456-426614174000',
        type: OrderType.PURCHASE,
        status: OrderStatus.PENDING,
        page: 2,
        limit: 5,
      });

      expect(orderService.findAllForUser).toHaveBeenCalledWith(
        'user-1',
        {
          nftId: '123e4567-e89b-12d3-a456-426614174000',
          type: OrderType.PURCHASE,
          status: OrderStatus.PENDING,
          fromDate: undefined,
          toDate: undefined,
        },
        { page: 2, limit: 5 },
      );
    });

    it('returns whatever OrderService.findAllForUser returns, as JSON', async () => {
      const payload = {
        items: [{ id: 'order-1' }],
        totalCount: 1,
        page: 1,
        limit: 20,
        hasNextPage: false,
      };
      orderService.findAllForUser.mockResolvedValue(payload);

      const result = await getTool('search_orders').run({});

      expect(JSON.parse(result as string)).toEqual(payload);
    });

    it('produces exactly one log entry when toolLogger is provided', async () => {
      orderService.findAllForUser.mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        limit: 20,
        hasNextPage: false,
      });
      const toolLogger = jest.fn();
      const tools = buildMarketplaceTools({
        ...otherDeps,
        orderService: orderService as never,
        userId: 'user-1',
        toolLogger,
      });
      const tool = tools.find((t) => t.name === 'search_orders');

      await tool!.run({ status: OrderStatus.COMPLETED });

      expect(toolLogger).toHaveBeenCalledTimes(1);
      expect(toolLogger).toHaveBeenCalledWith(
        'search_orders',
        { status: OrderStatus.COMPLETED },
        expect.any(String),
        expect.any(Number),
      );
    });

    it('produces a log entry even if the tool invocation fails', async () => {
      orderService.findAllForUser.mockRejectedValue(new Error('DB failure'));
      const toolLogger = jest.fn();
      const tools = buildMarketplaceTools({
        ...otherDeps,
        orderService: orderService as never,
        userId: 'user-1',
        toolLogger,
      });
      const tool = tools.find((t) => t.name === 'search_orders');

      await expect(
        tool!.run({ status: OrderStatus.COMPLETED }),
      ).rejects.toThrow('DB failure');

      expect(toolLogger).toHaveBeenCalledTimes(1);
      expect(toolLogger).toHaveBeenCalledWith(
        'search_orders',
        { status: OrderStatus.COMPLETED },
        'Error: DB failure',
        expect.any(Number),
      );
    });
  });

  describe('get_order', () => {
    it('requires a uuid id', () => {
      const tool = getTool('get_order');
      expect(() => {
        tool.parse({ id: 'not-a-uuid' });
      }).toThrow();
    });

    it('always checks ownership against the userId the tool was built with, not any input field', async () => {
      orderService.findOneForUser.mockResolvedValue({ id: 'order-1' });

      await getTool('get_order', 'the-real-caller').run({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(orderService.findOneForUser).toHaveBeenCalledWith(
        'the-real-caller',
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });

    it('propagates ForbiddenException from OrderService when the order belongs to another user', async () => {
      orderService.findOneForUser.mockRejectedValue(
        new ForbiddenException('You do not have access to this order'),
      );

      await expect(
        getTool('get_order', 'user-2').run({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('propagates NotFoundException from OrderService for an id that does not exist', async () => {
      orderService.findOneForUser.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await expect(
        getTool('get_order').run({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the order as JSON on success', async () => {
      const order = { id: 'order-1', status: OrderStatus.COMPLETED };
      orderService.findOneForUser.mockResolvedValue(order);

      const result = await getTool('get_order').run({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(JSON.parse(result as string)).toEqual(order);
    });
  });
});
