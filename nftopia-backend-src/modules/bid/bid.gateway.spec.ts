import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { BidGateway } from './bid.gateway';
import { BidSorobanStatus } from '../auction/entities/bid.entity';
import type { BidPlacedEvent } from './interfaces/bid.interface';

type RoomLike = ReturnType<Server['to']>;

const makeMockRoom = () => ({ emit: jest.fn() });

const makeMockServer = (
  room: ReturnType<typeof makeMockRoom>,
): jest.Mocked<Server> =>
  ({ to: jest.fn().mockReturnValue(room) }) as unknown as jest.Mocked<Server>;

const makeMockClient = (id = 'client-abc'): jest.Mocked<Socket> =>
  ({
    id,
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  }) as unknown as jest.Mocked<Socket>;

const makeBidPayload = (
  override: Partial<BidPlacedEvent> = {},
): BidPlacedEvent => ({
  auctionId: 'auction-123',
  bidderId: 'user-456',
  stellarPublicKey: 'GABC1234567890EXAMPLESTELLARKEY0000000000000000000000000',
  amount: 1_000_000,
  amountXlm: '100.0000000',
  txHash: 'abc123txhash',
  ledgerSequence: 100,
  sorobanStatus: BidSorobanStatus.CONFIRMED,
  timestamp: new Date('2024-01-01T00:00:00Z'),
  ...override,
});

describe('BidGateway', () => {
  let gateway: BidGateway;
  let mockRoom: ReturnType<typeof makeMockRoom>;
  let mockServer: jest.Mocked<Server>;
  let mockClient: jest.Mocked<Socket>;

  beforeEach(async () => {
    mockRoom = makeMockRoom();
    mockServer = makeMockServer(mockRoom);
    mockClient = makeMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BidGateway],
    }).compile();

    gateway = module.get<BidGateway>(BidGateway);
    Object.assign(gateway, { server: mockServer });

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Lifecycle hooks ────────────────────────────────────────────────────────

  describe('afterInit', () => {
    it('logs server initialisation', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      gateway.afterInit();
      expect(logSpy).toHaveBeenCalledWith(
        'BidGateway WebSocket server initialised',
      );
    });
  });

  describe('handleConnection', () => {
    it('logs the connected client id', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      gateway.handleConnection(mockClient);
      expect(debugSpy).toHaveBeenCalledWith(
        `Client connected: ${mockClient.id}`,
      );
    });

    it('handles clients with different ids without throwing', () => {
      const clients = [
        makeMockClient('c-1'),
        makeMockClient('c-2'),
        makeMockClient('c-3'),
      ];
      clients.forEach((c) =>
        expect(() => gateway.handleConnection(c)).not.toThrow(),
      );
    });
  });

  describe('handleDisconnect', () => {
    it('logs the disconnected client id', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      gateway.handleDisconnect(mockClient);
      expect(debugSpy).toHaveBeenCalledWith(
        `Client disconnected: ${mockClient.id}`,
      );
    });

    it('handles multiple disconnecting clients without throwing', () => {
      const clients = [makeMockClient('d-1'), makeMockClient('d-2')];
      clients.forEach((c) =>
        expect(() => gateway.handleDisconnect(c)).not.toThrow(),
      );
    });
  });

  // ─── Room management ────────────────────────────────────────────────────────

  describe('handleJoinAuction', () => {
    it('joins client to auction:<id> room', () => {
      gateway.handleJoinAuction({ auctionId: 'auction-123' }, mockClient);
      expect(mockClient.join).toHaveBeenCalledWith('auction:auction-123');
    });

    it('returns joined event with the auctionId', () => {
      const result = gateway.handleJoinAuction(
        { auctionId: 'auction-123' },
        mockClient,
      );
      expect(result).toEqual({
        event: 'joined',
        data: { auctionId: 'auction-123' },
      });
    });

    it('logs the join with client id and room', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      gateway.handleJoinAuction({ auctionId: 'auction-456' }, mockClient);
      expect(debugSpy).toHaveBeenCalledWith(
        `${mockClient.id} joined room auction:auction-456`,
      );
    });

    it('works with UUID-formatted auction ids', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = gateway.handleJoinAuction({ auctionId: uuid }, mockClient);
      expect(mockClient.join).toHaveBeenCalledWith(`auction:${uuid}`);
      expect(result).toEqual({ event: 'joined', data: { auctionId: uuid } });
    });

    it('allows one client to join multiple auction rooms', () => {
      gateway.handleJoinAuction({ auctionId: 'a-1' }, mockClient);
      gateway.handleJoinAuction({ auctionId: 'a-2' }, mockClient);
      expect(mockClient.join).toHaveBeenCalledTimes(2);
      expect(mockClient.join).toHaveBeenCalledWith('auction:a-1');
      expect(mockClient.join).toHaveBeenCalledWith('auction:a-2');
    });

    it('allows multiple clients to join the same auction room', () => {
      const client2 = makeMockClient('client-2');
      gateway.handleJoinAuction({ auctionId: 'shared' }, mockClient);
      gateway.handleJoinAuction({ auctionId: 'shared' }, client2);
      expect(mockClient.join).toHaveBeenCalledWith('auction:shared');
      expect(client2.join).toHaveBeenCalledWith('auction:shared');
    });
  });

  describe('handleLeaveAuction', () => {
    it('removes client from auction:<id> room', () => {
      gateway.handleLeaveAuction({ auctionId: 'auction-123' }, mockClient);
      expect(mockClient.leave).toHaveBeenCalledWith('auction:auction-123');
    });

    it('returns left event with the auctionId', () => {
      const result = gateway.handleLeaveAuction(
        { auctionId: 'auction-123' },
        mockClient,
      );
      expect(result).toEqual({
        event: 'left',
        data: { auctionId: 'auction-123' },
      });
    });

    it('logs the leave with client id and room', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      gateway.handleLeaveAuction({ auctionId: 'auction-789' }, mockClient);
      expect(debugSpy).toHaveBeenCalledWith(
        `${mockClient.id} left room auction:auction-789`,
      );
    });

    it('works with UUID-formatted auction ids', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = gateway.handleLeaveAuction(
        { auctionId: uuid },
        mockClient,
      );
      expect(mockClient.leave).toHaveBeenCalledWith(`auction:${uuid}`);
      expect(result).toEqual({ event: 'left', data: { auctionId: uuid } });
    });

    it('leaves independently from other joined rooms', () => {
      gateway.handleJoinAuction({ auctionId: 'stay' }, mockClient);
      gateway.handleJoinAuction({ auctionId: 'exit' }, mockClient);
      gateway.handleLeaveAuction({ auctionId: 'exit' }, mockClient);
      expect(mockClient.leave).toHaveBeenCalledTimes(1);
      expect(mockClient.leave).toHaveBeenCalledWith('auction:exit');
    });
  });

  describe('join then leave round-trip', () => {
    it('join and leave call the correct socket methods in order', () => {
      const auctionId = 'auction-xyz';
      gateway.handleJoinAuction({ auctionId }, mockClient);
      gateway.handleLeaveAuction({ auctionId }, mockClient);
      expect(mockClient.join).toHaveBeenCalledWith(`auction:${auctionId}`);
      expect(mockClient.leave).toHaveBeenCalledWith(`auction:${auctionId}`);
    });
  });

  // ─── Bid broadcast ──────────────────────────────────────────────────────────

  describe('handleBidPlacedEvent', () => {
    it('broadcasts bid-placed to the correct auction room', () => {
      const payload = makeBidPayload({ auctionId: 'auction-abc' });
      gateway.handleBidPlacedEvent(payload);
      expect(mockServer.to).toHaveBeenCalledWith('auction:auction-abc');
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'bid-placed',
        expect.any(Object),
      );
    });

    it('broadcasts all required bid fields', () => {
      const payload = makeBidPayload();
      gateway.handleBidPlacedEvent(payload);
      expect(mockRoom.emit).toHaveBeenCalledWith('bid-placed', {
        auctionId: payload.auctionId,
        bidderId: payload.bidderId,
        amount: payload.amount,
        amountXlm: payload.amountXlm,
        txHash: payload.txHash,
        ledgerSequence: payload.ledgerSequence,
        sorobanStatus: payload.sorobanStatus,
        timestamp: payload.timestamp,
      });
    });

    it('does not expose stellarPublicKey in the broadcast payload', () => {
      const payload = makeBidPayload();
      gateway.handleBidPlacedEvent(payload);
      const callArgs = mockRoom.emit.mock.calls[0] as unknown as [
        string,
        Record<string, unknown>,
      ];
      const broadcasted = callArgs[1];
      expect(broadcasted).not.toHaveProperty('stellarPublicKey');
    });

    it('logs the broadcast with room and amount', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const payload = makeBidPayload({ amountXlm: '150.0000000' });
      gateway.handleBidPlacedEvent(payload);
      expect(debugSpy).toHaveBeenCalledWith(
        `Broadcast bid-placed to room auction:${payload.auctionId}: ${payload.amountXlm} XLM`,
      );
    });

    it('routes different auction events to their respective rooms', () => {
      const room2 = makeMockRoom();
      mockServer.to
        .mockReturnValueOnce(mockRoom as unknown as RoomLike)
        .mockReturnValueOnce(room2 as unknown as RoomLike);

      gateway.handleBidPlacedEvent(makeBidPayload({ auctionId: 'auction-A' }));
      gateway.handleBidPlacedEvent(makeBidPayload({ auctionId: 'auction-B' }));

      expect(mockServer.to).toHaveBeenCalledWith('auction:auction-A');
      expect(mockServer.to).toHaveBeenCalledWith('auction:auction-B');
      expect(mockRoom.emit).toHaveBeenCalledTimes(1);
      expect(room2.emit).toHaveBeenCalledTimes(1);
    });

    it('handles PENDING soroban status', () => {
      const payload = makeBidPayload({
        sorobanStatus: BidSorobanStatus.PENDING,
      });
      gateway.handleBidPlacedEvent(payload);
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'bid-placed',
        expect.objectContaining({ sorobanStatus: BidSorobanStatus.PENDING }),
      );
    });

    it('handles FAILED soroban status', () => {
      const payload = makeBidPayload({
        sorobanStatus: BidSorobanStatus.FAILED,
      });
      gateway.handleBidPlacedEvent(payload);
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'bid-placed',
        expect.objectContaining({ sorobanStatus: BidSorobanStatus.FAILED }),
      );
    });

    it('handles SKIPPED soroban status', () => {
      const payload = makeBidPayload({
        sorobanStatus: BidSorobanStatus.SKIPPED,
      });
      gateway.handleBidPlacedEvent(payload);
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'bid-placed',
        expect.objectContaining({ sorobanStatus: BidSorobanStatus.SKIPPED }),
      );
    });

    it('handles payload without optional txHash and ledgerSequence', () => {
      const payload = makeBidPayload({
        txHash: undefined,
        ledgerSequence: undefined,
      });
      expect(() => gateway.handleBidPlacedEvent(payload)).not.toThrow();
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'bid-placed',
        expect.objectContaining({
          txHash: undefined,
          ledgerSequence: undefined,
        }),
      );
    });

    it('emits exactly once per event', () => {
      gateway.handleBidPlacedEvent(makeBidPayload());
      expect(mockRoom.emit).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Connection / disconnection lifecycle edge cases ───────────────────────

  describe('connection lifecycle', () => {
    it('connection followed by disconnection does not throw', () => {
      expect(() => {
        gateway.handleConnection(mockClient);
        gateway.handleDisconnect(mockClient);
      }).not.toThrow();
    });

    it('disconnect without prior connection does not throw', () => {
      const freshClient = makeMockClient('orphan');
      expect(() => gateway.handleDisconnect(freshClient)).not.toThrow();
    });
  });
});
