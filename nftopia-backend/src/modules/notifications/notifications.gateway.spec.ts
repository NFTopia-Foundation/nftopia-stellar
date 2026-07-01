import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
  ({
    to: jest.fn(),
    on: jest.fn(),
    engine: {
      opts: {},
      on: jest.fn(),
    },
    sockets: {
      sockets: new Map<string, jest.Mocked<Socket>>(),
    },
  }) as unknown as jest.Mocked<Server>;

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
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'WEBSOCKET_MAX_MESSAGE_SIZE_BYTES') return '65536';
        if (key === 'WS_PING_INTERVAL_MS') return '25000';
        if (key === 'WS_PING_TIMEOUT_MS') return '30000';
        if (key === 'WS_STALE_THRESHOLD_MS') return '60000';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
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
    it('logs gateway initialisation with message size limit', () => {
      const spy = jest.spyOn(Logger.prototype, 'log');
      gateway.afterInit();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining(
          'NotificationsGateway initialised on /notifications with max message size: 65536 bytes',
        ),
      );
    });

    it('sets maxHttpBufferSize from config', () => {
      gateway.afterInit();
      expect(mockServer.engine.opts.maxHttpBufferSize).toBe(65536);
    });

    it('uses custom message size limit from config', async () => {
      const customConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'WEBSOCKET_MAX_MESSAGE_SIZE_BYTES') return '131072';
          return undefined;
        }),
      } as unknown as jest.Mocked<ConfigService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationsGateway,
          { provide: JwtService, useValue: makeJwtService(jwtVerify) },
          { provide: ConfigService, useValue: customConfigService },
        ],
      }).compile();

      const customGateway =
        module.get<NotificationsGateway>(NotificationsGateway);
      Object.assign(customGateway, { server: mockServer });

      customGateway.afterInit();
      expect(mockServer.engine.opts.maxHttpBufferSize).toBe(131072);
    });
  });

  // ── getServer ─────────────────────────────────────────────────────────────

  describe('getServer', () => {
    it('returns the underlying io.Server', () => {
      expect(gateway.getServer()).toBe(mockServer);
    });
  });

  // ── getClients ────────────────────────────────────────────────────────────

  describe('getClients', () => {
    it('returns an empty map before any connections', () => {
      expect(gateway.getClients().size).toBe(0);
    });

    it('contains metadata for authenticated clients', () => {
      const client = makeSocket({ id: 'c1', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(gateway.getClients().has('c1')).toBe(true);
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

    it('stores client metadata in the clients map', () => {
      const client = makeSocket({ id: 'c-meta', auth: { token: VALID_TOKEN } });
      const before = Date.now();
      gateway.handleConnection(client);
      const meta = gateway.getClients().get('c-meta');
      expect(meta).toBeDefined();
      expect(meta!.userId).toBe(VALID_PAYLOAD.sub);
      expect(meta!.connectedAt).toBeGreaterThanOrEqual(before);
      expect(meta!.lastHeartbeat).toBeGreaterThanOrEqual(before);
      expect(meta!.rooms.has(`user:${VALID_PAYLOAD.sub}`)).toBe(true);
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

  // ── handleConnection — reconnect ──────────────────────────────────────────

  describe('handleConnection — reconnect / connection_recovered', () => {
    it('emits connection_recovered when a prior session exists for the same user', () => {
      const c1 = makeSocket({ id: 'c1', auth: { token: VALID_TOKEN } });
      const c2 = makeSocket({ id: 'c2', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(c1);
      gateway.handleConnection(c2);
      expect(c2.emit).toHaveBeenCalledWith('connection_recovered', {
        userId: VALID_PAYLOAD.sub,
      });
    });

    it('emits "connected" (not connection_recovered) for brand-new sessions', () => {
      const client = makeSocket({ auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('connected', {
        userId: VALID_PAYLOAD.sub,
      });
      expect(client.emit).not.toHaveBeenCalledWith(
        'connection_recovered',
        expect.anything(),
      );
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

    it('does NOT add unauthenticated client to clients map', () => {
      const client = makeSocket({ id: 'unauth' });
      gateway.handleConnection(client);
      expect(gateway.getClients().has('unauth')).toBe(false);
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
      gateway.handleConnection(client);
      spy.mockClear();

      gateway.handleDisconnect(client);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('user-42'));
    });

    it('removes client from clients map on disconnect', () => {
      const client = makeSocket({ id: 'c-disc', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      expect(gateway.getClients().has('c-disc')).toBe(true);
      gateway.handleDisconnect(client);
      expect(gateway.getClients().has('c-disc')).toBe(false);
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

  // ── handlePing ────────────────────────────────────────────────────────────

  describe('handlePing', () => {
    it('returns pong event with a numeric timestamp', () => {
      const client = makeSocket({ id: 'p1', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      const result = gateway.handlePing(undefined, client);
      expect(result.event).toBe('pong');
      expect(typeof result.timestamp).toBe('number');
    });

    it('updates lastHeartbeat in client metadata', () => {
      jest.useFakeTimers();
      const client = makeSocket({ id: 'p2', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);

      const before = gateway.getClients().get('p2')!.lastHeartbeat;
      jest.advanceTimersByTime(5000);
      gateway.handlePing(undefined, client);
      const after = gateway.getClients().get('p2')!.lastHeartbeat;

      expect(after).toBeGreaterThan(before);
      jest.useRealTimers();
    });

    it('does not throw when client is not in clients map', () => {
      const client = makeSocket({ id: 'unknown' });
      expect(() => gateway.handlePing(undefined, client)).not.toThrow();
    });

    it('pong timestamp is close to Date.now()', () => {
      const client = makeSocket({ id: 'p3', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      const before = Date.now();
      const result = gateway.handlePing(undefined, client);
      const after = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ── cleanupStaleConnections ───────────────────────────────────────────────

  describe('cleanupStaleConnections', () => {
    beforeEach(() => {
      gateway.afterInit();
    });

    it('removes stale sockets from the clients map', () => {
      jest.useFakeTimers();
      const client = makeSocket({
        id: 'stale-1',
        auth: { token: VALID_TOKEN },
      });
      gateway.handleConnection(client);

      // Advance past staleThresholdMs (60 000 ms)
      jest.advanceTimersByTime(61_000);

      // Register the socket in the server's sockets map
      (
        mockServer.sockets.sockets as unknown as Map<
          string,
          jest.Mocked<Socket>
        >
      ).set('stale-1', client);

      gateway.cleanupStaleConnections();

      expect(gateway.getClients().has('stale-1')).toBe(false);
      jest.useRealTimers();
    });

    it('disconnects the underlying socket when stale', () => {
      jest.useFakeTimers();
      const client = makeSocket({
        id: 'stale-2',
        auth: { token: VALID_TOKEN },
      });
      gateway.handleConnection(client);
      jest.advanceTimersByTime(61_000);

      (
        mockServer.sockets.sockets as unknown as Map<
          string,
          jest.Mocked<Socket>
        >
      ).set('stale-2', client);

      gateway.cleanupStaleConnections();

      expect(client.disconnect).toHaveBeenCalledWith(true);
      jest.useRealTimers();
    });

    it('does NOT remove fresh connections', () => {
      jest.useFakeTimers();
      const client = makeSocket({
        id: 'fresh-1',
        auth: { token: VALID_TOKEN },
      });
      gateway.handleConnection(client);

      // Only advance 10 s — well within threshold
      jest.advanceTimersByTime(10_000);
      gateway.cleanupStaleConnections();

      expect(gateway.getClients().has('fresh-1')).toBe(true);
      jest.useRealTimers();
    });

    it('keeps connection alive after ping resets heartbeat', () => {
      jest.useFakeTimers();
      const client = makeSocket({ id: 'kept-1', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);

      // Advance 50 s and then ping (resets heartbeat)
      jest.advanceTimersByTime(50_000);
      gateway.handlePing(undefined, client);

      // Advance another 50 s — total 100 s but heartbeat was reset at 50 s
      jest.advanceTimersByTime(50_000);
      gateway.cleanupStaleConnections();

      expect(gateway.getClients().has('kept-1')).toBe(true);
      jest.useRealTimers();
    });

    it('logs a warning when forcing stale disconnect', () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const client = makeSocket({
        id: 'stale-3',
        auth: { token: VALID_TOKEN },
      });
      gateway.handleConnection(client);
      jest.advanceTimersByTime(61_000);

      (
        mockServer.sockets.sockets as unknown as Map<
          string,
          jest.Mocked<Socket>
        >
      ).set('stale-3', client);

      gateway.cleanupStaleConnections();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('stale-3'));
      jest.useRealTimers();
    });

    it('does nothing when no clients are connected', () => {
      expect(() => gateway.cleanupStaleConnections()).not.toThrow();
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

    it('tracks auction room in client metadata', () => {
      const client = makeSocket({ id: 'r1', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      gateway.handleJoinAuction({ auctionId: 'auction-99' }, client);
      expect(
        gateway.getClients().get('r1')?.rooms.has('auction:auction-99'),
      ).toBe(true);
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

    it('removes auction room from client metadata', () => {
      const client = makeSocket({ id: 'r2', auth: { token: VALID_TOKEN } });
      gateway.handleConnection(client);
      gateway.handleJoinAuction({ auctionId: 'auction-10' }, client);
      gateway.handleLeaveAuction({ auctionId: 'auction-10' }, client);
      expect(
        gateway.getClients().get('r2')?.rooms.has('auction:auction-10'),
      ).toBe(false);
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
