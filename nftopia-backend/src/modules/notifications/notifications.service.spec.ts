import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import type { BidUpdatePayload } from './interfaces/notification.interface';

// ── helpers ─────────────────────────────────────────────────────────────────

const makeRoom = () => ({ emit: jest.fn() });

const makeServer = (room: ReturnType<typeof makeRoom>): jest.Mocked<Server> =>
  ({ to: jest.fn().mockReturnValue(room) }) as unknown as jest.Mocked<Server>;

const makeGateway = (
  server: jest.Mocked<Server>,
): jest.Mocked<NotificationsGateway> =>
  ({
    getServer: jest.fn().mockReturnValue(server),
  }) as unknown as jest.Mocked<NotificationsGateway>;

const makeBidUpdate = (
  override: Partial<BidUpdatePayload> = {},
): BidUpdatePayload => ({
  auctionId: 'auction-123',
  amount: 150,
  amountXlm: '150.0000000',
  bidderId: 'user-456',
  txHash: 'txhash123',
  ledgerSequence: 500,
  timestamp: '2024-01-01T00:00:00.000Z',
  ...override,
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;
  let room: ReturnType<typeof makeRoom>;
  let mockServer: jest.Mocked<Server>;
  let mockGateway: jest.Mocked<NotificationsGateway>;

  beforeEach(async () => {
    room = makeRoom();
    mockServer = makeServer(room);
    mockGateway = makeGateway(mockServer);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  // ── notifyUser ─────────────────────────────────────────────────────────────

  describe('notifyUser', () => {
    it('emits notification event to the correct user room', () => {
      service.notifyUser('user-1', 'bid.received', 'New Bid');
      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(room.emit).toHaveBeenCalledWith(
        'notification',
        expect.any(Object),
      );
    });

    it('payload contains the correct type and title', () => {
      service.notifyUser('user-1', 'item.sold', 'Item Sold');
      const [, payload] = room.emit.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(payload.type).toBe('item.sold');
      expect(payload.title).toBe('Item Sold');
    });

    it('payload includes message when provided', () => {
      service.notifyUser(
        'user-1',
        'bid.received',
        'New Bid',
        'User X bid 100 XLM',
      );
      const [, payload] = room.emit.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(payload.message).toBe('User X bid 100 XLM');
    });

    it('payload includes data when provided', () => {
      const data = { auctionId: 'auction-99', amount: 100 };
      service.notifyUser('user-1', 'bid.received', 'New Bid', undefined, data);
      const [, payload] = room.emit.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(payload.data).toEqual(data);
    });

    it('payload includes a non-empty id', () => {
      service.notifyUser('user-1', 'auction.won', 'You Won!');
      const [, payload] = room.emit.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(typeof payload.id).toBe('string');
      expect((payload.id as string).length).toBeGreaterThan(0);
    });

    it('payload includes an ISO timestamp', () => {
      service.notifyUser('user-1', 'auction.won', 'You Won!');
      const [, payload] = room.emit.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(typeof payload.timestamp).toBe('string');
      expect(new Date(payload.timestamp as string).toString()).not.toBe(
        'Invalid Date',
      );
    });

    it('each call generates a unique notification id', () => {
      service.notifyUser('user-1', 'bid.received', 'Bid 1');
      service.notifyUser('user-1', 'bid.received', 'Bid 2');
      const id1 = (room.emit.mock.calls[0] as [string, { id: string }])[1].id;
      const id2 = (room.emit.mock.calls[1] as [string, { id: string }])[1].id;
      expect(id1).not.toBe(id2);
    });

    it('notifies different users in their respective rooms', () => {
      const room2 = makeRoom();
      mockServer.to
        .mockReturnValueOnce(room as unknown as ReturnType<Server['to']>)
        .mockReturnValueOnce(room2 as unknown as ReturnType<Server['to']>);

      service.notifyUser('user-A', 'bid.received', 'Bid on A');
      service.notifyUser('user-B', 'item.sold', 'Item Sold');

      expect(mockServer.to).toHaveBeenCalledWith('user:user-A');
      expect(mockServer.to).toHaveBeenCalledWith('user:user-B');
      expect(room.emit).toHaveBeenCalledTimes(1);
      expect(room2.emit).toHaveBeenCalledTimes(1);
    });

    it('works when message and data are both undefined', () => {
      expect(() =>
        service.notifyUser('user-1', 'bid.received', 'New Bid'),
      ).not.toThrow();
    });

    it('emits once per call', () => {
      service.notifyUser('user-1', 'bid.received', 'New Bid');
      expect(room.emit).toHaveBeenCalledTimes(1);
    });
  });

  // ── broadcastBidUpdate ────────────────────────────────────────────────────

  describe('broadcastBidUpdate', () => {
    it('emits bid_update event to the correct auction room', () => {
      const payload = makeBidUpdate({ auctionId: 'auction-abc' });
      service.broadcastBidUpdate('auction-abc', payload);
      expect(mockServer.to).toHaveBeenCalledWith('auction:auction-abc');
      expect(room.emit).toHaveBeenCalledWith('bid_update', payload);
    });

    it('passes the full payload through unchanged', () => {
      const payload = makeBidUpdate();
      service.broadcastBidUpdate(payload.auctionId, payload);
      const [, emitted] = room.emit.mock.calls[0] as [string, BidUpdatePayload];
      expect(emitted).toEqual(payload);
    });

    it('broadcasts different auctions to their respective rooms', () => {
      const room2 = makeRoom();
      mockServer.to
        .mockReturnValueOnce(room as unknown as ReturnType<Server['to']>)
        .mockReturnValueOnce(room2 as unknown as ReturnType<Server['to']>);

      service.broadcastBidUpdate(
        'auction-1',
        makeBidUpdate({ auctionId: 'auction-1' }),
      );
      service.broadcastBidUpdate(
        'auction-2',
        makeBidUpdate({ auctionId: 'auction-2' }),
      );

      expect(mockServer.to).toHaveBeenCalledWith('auction:auction-1');
      expect(mockServer.to).toHaveBeenCalledWith('auction:auction-2');
      expect(room.emit).toHaveBeenCalledTimes(1);
      expect(room2.emit).toHaveBeenCalledTimes(1);
    });

    it('handles payload without optional txHash / ledgerSequence', () => {
      const payload = makeBidUpdate({
        txHash: undefined,
        ledgerSequence: undefined,
      });
      expect(() =>
        service.broadcastBidUpdate(payload.auctionId, payload),
      ).not.toThrow();
      expect(room.emit).toHaveBeenCalledWith('bid_update', payload);
    });

    it('emits once per call', () => {
      service.broadcastBidUpdate('auction-1', makeBidUpdate());
      expect(room.emit).toHaveBeenCalledTimes(1);
    });
  });
});
