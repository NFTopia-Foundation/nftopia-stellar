import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { NotificationsGateway } from './notifications.gateway';

// ── helpers ─────────────────────────────────────────────────────────────────

const makeJwtService = (
  verify: jest.Mock = jest.fn(),
): jest.Mocked<JwtService> =>
  ({ verify }) as unknown as jest.Mocked<JwtService>;

const makeSocket = (
  overrides: Partial<{
    id: string;
    auth: Record<string, unknown>;
    query: Record<string, string>;
    headers: Record<string, string>;
    data: Record<string, unknown>;
  }> = {},
): jest.Mocked<Socket> => {
  const {
    id = 'socket-1',
    auth = {},
    query = {},
    headers = {},
    data = {},
  } = overrides;
  return {
    id,
    handshake: { auth, query, headers },
    data,
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as jest.Mocked<Socket>;
};

const makeServer = (): jest.Mocked<Server> =>
  ({ to: jest.fn() }) as unknown as jest.Mocked<Server>;

const VALID_PAYLOAD = { sub: 'user-42', username: 'alice', email: 'a@b.com' };
const VALID_TOKEN = 'valid.jwt.token';

// ── test suite ───────────────────────────────────────────────────────────────

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtVerify: jest.Mock;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    jwtVerify = jest.fn().mockReturnValue(VALID_PAYLOAD);
    const jwtService = makeJwtService(jwtVerify);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    mockServer = makeServer();
    Object.assign(gateway, { server: mockServer });

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  // ── lifecycle ──────────────────────────────────────────────────────────────

  describe('afterInit', () => {
    it('logs gateway initialisation', () => {
      const spy = jest.spyOn(Logger.prototype, 'log');
      gateway.afterInit();
      expect(spy).toHaveBeenCalledWith(
        'NotificationsGateway initialised on /notifications',
      );
    });
  });

  // ── getServer ─────────────────────────────────────────────────────────────

  describe('getServer', () => {
    it('returns the underlying io.Server', () => {
      expect(gateway.getServer()).toBe(mockServer);
    });
  });

  // ── handleConnection — token extraction ───────────────────────────────────

  describe('handleConnection — valid auth via auth.token', () => {
    it('joins user to user:<userId> room on successful auth', () => {
      const client = makeSocket({ auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith(`user:${VALID_PAYLOAD.sub}`);
    });

    it('emits "connected" event with userId on success', () => {
      const client = makeSocket({ auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('connected', {
        userId: VALID_PAYLOAD.sub,
      });
    });

    it('attaches user metadata to client.data', () => {
      const client = makeSocket({ auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);

      const storedUser = (client.data as { user?: unknown }).user;
      expect(storedUser).toEqual({
        userId: VALID_PAYLOAD.sub,
        username: VALID_PAYLOAD.username,
        email: VALID_PAYLOAD.email,
      });
    });

    it('does NOT call disconnect on valid token', () => {
      const client = makeSocket({ auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection — valid auth via query param', () => {
    it('accepts token from query string', () => {
      jwtVerify.mockReturnValue(VALID_PAYLOAD);
      const client = makeSocket({ query: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith(`user:${VALID_PAYLOAD.sub}`);
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection — valid auth via Authorization header', () => {
    it('accepts Bearer token from Authorization header', () => {
      jwtVerify.mockReturnValue(VALID_PAYLOAD);
      const client = makeSocket({
        headers: { authorization: `Bearer ${VALID_TOKEN}` },
      });
      gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith(`user:${VALID_PAYLOAD.sub}`);
    });

    it('accepts raw token (no Bearer prefix) from Authorization header', () => {
      jwtVerify.mockReturnValue(VALID_PAYLOAD);
      const client = makeSocket({ headers: { authorization: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith(`user:${VALID_PAYLOAD.sub}`);
    });
  });

  // ── handleConnection — rejection paths ────────────────────────────────────

  describe('handleConnection — missing token', () => {
    it('emits auth_error with reason missing_token', () => {
      const client = makeSocket();
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('auth_error', {
        reason: 'missing_token',
      });
    });

    it('disconnects the client when token is absent', () => {
      const client = makeSocket();
      gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('does NOT join any room when token is absent', () => {
      const client = makeSocket();
      gateway.handleConnection(client);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection — invalid token', () => {
    it('emits auth_error with reason invalid_token', () => {
      jwtVerify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const client = makeSocket({ auth: { token: 'bad.token' } });
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('auth_error', {
        reason: 'invalid_token',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleConnection — expired token', () => {
    it('emits auth_error with reason token_expired', () => {
      jwtVerify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const client = makeSocket({ auth: { token: 'expired.token' } });
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('auth_error', {
        reason: 'token_expired',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  // ── handleDisconnect ──────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('logs authenticated user disconnect', () => {
      const spy = jest.spyOn(Logger.prototype, 'debug');
      const client = makeSocket({
        auth: { token: VALID_TOKEN },
        data: { user: { userId: 'user-42' } },
      });
      // Simulate prior auth
      gateway.handleConnection(client);
      spy.mockClear();

      gateway.handleDisconnect(client);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('user-42'));
    });

    it('handles unauthenticated disconnect without throwing', () => {
      const client = makeSocket();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });

    it('logs anonymous socket id on unauthenticated disconnect', () => {
      const spy = jest.spyOn(Logger.prototype, 'debug');
      const client = makeSocket({ id: 'anon-socket' });
      gateway.handleDisconnect(client);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('anon-socket'));
    });
  });

  // ── join_auction / leave_auction ──────────────────────────────────────────

  describe('handleJoinAuction', () => {
    it('joins the socket to auction:<id> room', () => {
      const client = makeSocket();
      gateway.handleJoinAuction({ auctionId: 'auction-1' }, client);
      expect(client.join).toHaveBeenCalledWith('auction:auction-1');
    });

    it('returns ok acknowledgement with auctionId', () => {
      const client = makeSocket();
      const result = gateway.handleJoinAuction(
        { auctionId: 'auction-1' },
        client,
      );
      expect(result).toEqual({
        event: 'join_auction:ok',
        auctionId: 'auction-1',
      });
    });

    it('returns error when auctionId is missing', () => {
      const client = makeSocket();
      const result = gateway.handleJoinAuction(undefined, client);
      expect(result).toEqual({
        event: 'join_auction:error',
        error: 'auctionId required',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('returns error when body is empty object', () => {
      const client = makeSocket();
      const result = gateway.handleJoinAuction({}, client);
      expect(result).toEqual({
        event: 'join_auction:error',
        error: 'auctionId required',
      });
    });

    it('allows joining multiple auction rooms', () => {
      const client = makeSocket();
      gateway.handleJoinAuction({ auctionId: 'a-1' }, client);
      gateway.handleJoinAuction({ auctionId: 'a-2' }, client);
      expect(client.join).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleLeaveAuction', () => {
    it('removes socket from auction:<id> room', () => {
      const client = makeSocket();
      gateway.handleLeaveAuction({ auctionId: 'auction-1' }, client);
      expect(client.leave).toHaveBeenCalledWith('auction:auction-1');
    });

    it('returns ok acknowledgement with auctionId', () => {
      const client = makeSocket();
      const result = gateway.handleLeaveAuction(
        { auctionId: 'auction-1' },
        client,
      );
      expect(result).toEqual({
        event: 'leave_auction:ok',
        auctionId: 'auction-1',
      });
    });

    it('returns error when auctionId is missing', () => {
      const client = makeSocket();
      const result = gateway.handleLeaveAuction(undefined, client);
      expect(result).toEqual({
        event: 'leave_auction:error',
        error: 'auctionId required',
      });
      expect(client.leave).not.toHaveBeenCalled();
    });
  });

  // ── join → leave round-trip ───────────────────────────────────────────────

  describe('join then leave round-trip', () => {
    it('calls join then leave in the correct order', () => {
      const client = makeSocket();
      gateway.handleJoinAuction({ auctionId: 'auction-xyz' }, client);
      gateway.handleLeaveAuction({ auctionId: 'auction-xyz' }, client);
      expect(client.join).toHaveBeenCalledWith('auction:auction-xyz');
      expect(client.leave).toHaveBeenCalledWith('auction:auction-xyz');
    });
  });
});
