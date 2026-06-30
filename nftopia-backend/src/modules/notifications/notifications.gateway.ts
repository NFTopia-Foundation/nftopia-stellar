import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { getNotificationsConfig } from './notifications.config';
import {
  AuthenticatedSocketUser,
  auctionRoom,
  userRoom,
} from './interfaces/notification.interface';

// Type alias for Socket with typed data property
type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthenticatedSocketUser;
    [key: string]: unknown;
  };
};

/** Metadata tracked per connected socket. */
export interface ClientMeta {
  socketId: string;
  userId: string;
  connectedAt: number;
  lastHeartbeat: number;
  rooms: Set<string>;
}

/**
 * JWT-authenticated WebSocket gateway that powers real-time notifications.
 *
 * ### Auth
 * The JWT token can be supplied via either:
 *   1. `auth` payload:     io({ auth: { token } })
 *   2. query parameter:    io('/notifications?token=...')
 *   3. `Authorization` hdr: extraHeaders: { Authorization: 'Bearer ...' }
 *
 * ### Heartbeat / ping-pong
 * - Socket.IO transport-level ping is configured via `pingInterval` /
 *   `pingTimeout` (from env `WS_PING_INTERVAL_MS` / `WS_PING_TIMEOUT_MS`).
 * - Clients may also emit `ping` to receive a `pong` response with a server
 *   timestamp. This updates the client's last-heartbeat timestamp.
 * - A `@Interval`-based job runs every minute to force-disconnect sockets
 *   whose last heartbeat is older than `WS_STALE_THRESHOLD_MS` (default 60 s).
 *
 * ### Client heartbeat strategy
 * ```js
 * // Recommended: emit ping every 30 s and handle reconnection
 * setInterval(() => socket.emit('ping'), 30_000);
 * socket.on('disconnect', () => reconnectWithBackoff());
 * socket.on('connection_recovered', () => socket.emit('join_auction', { auctionId }));
 * ```
 *
 * ### Rooms
 * On successful auth the socket is added to `user:{userId}`.
 * Clients may additionally join `auction:{auctionId}` rooms via
 * `join_auction` / `leave_auction`.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
  pingInterval: Number(process.env.WS_PING_INTERVAL_MS ?? 25_000),
  pingTimeout: Number(process.env.WS_PING_TIMEOUT_MS ?? 30_000),
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  /** Per-socket metadata map: socketId → ClientMeta */
  private readonly clients = new Map<string, ClientMeta>();

  private staleThresholdMs!: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Expose the underlying io.Server for the service to emit against. */
  getServer(): Server {
    return this.server;
  }

  /** Expose client metadata map (used in tests / monitoring). */
  getClients(): ReadonlyMap<string, ClientMeta> {
    return this.clients;
  }

  afterInit(): void {
    const config = getNotificationsConfig(this.configService);
    this.staleThresholdMs = config.websocket.staleThresholdMs;

    if (this.server?.engine?.opts) {
      this.server.engine.opts.maxHttpBufferSize =
        config.websocket.maxMessageSizeBytes;
      this.logger.log(
        `NotificationsGateway initialised on /notifications with max message size: ${config.websocket.maxMessageSizeBytes} bytes`,
      );
    } else {
      this.logger.warn(
        'WebSocket server engine options not available. Using default maxHttpBufferSize.',
      );
    }

    if (this.server) {
      this.server.on(
        'connection_error',
        (error: { description?: string; code?: number }) => {
          if (error.description === 'payload too large' || error.code === 413) {
            this.logger.warn(
              `WebSocket connection rejected: message size exceeds limit of ${config.websocket.maxMessageSizeBytes} bytes`,
            );
          }
        },
      );

      if (this.server.engine) {
        this.server.engine.on(
          'connection_error',
          (error: { code?: string; message?: string }) => {
            if (
              error.code === 'ERR_HTTP_HEADERS_SENT' ||
              error.message?.includes('payload')
            ) {
              this.logger.warn(
                `WebSocket engine error: ${error.message}. This may indicate an oversized message.`,
              );
            }
          },
        );
      }
    }
  }

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);
    if (!token) {
      this.rejectClient(client, 'missing_token');
      return;
    }

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        username?: string;
        email?: string;
      }>(token, {
        secret:
          process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      });

      const user: AuthenticatedSocketUser = {
        userId: payload.sub,
        username: payload.username,
        email: payload.email,
      };

      const typedClient = client as AuthenticatedSocket;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typedClient.data.user = user;

      void client.join(userRoom(user.userId));

      const now = Date.now();
      this.clients.set(client.id, {
        socketId: client.id,
        userId: user.userId,
        connectedAt: now,
        lastHeartbeat: now,
        rooms: new Set([userRoom(user.userId)]),
      });

      this.logger.debug(
        `Client ${client.id} authenticated as user ${user.userId}`,
      );

      // Emit connection_recovered when a prior session for this user existed
      const hadPriorSession = [...this.clients.values()].some(
        (m) => m.userId === user.userId && m.socketId !== client.id,
      );
      if (hadPriorSession) {
        client.emit('connection_recovered', { userId: user.userId });
        this.logger.debug(
          `connection_recovered emitted for user ${user.userId}`,
        );
      } else {
        client.emit('connected', { userId: user.userId });
      }
    } catch (err) {
      const reason =
        err instanceof Error && /expired/i.test(err.message)
          ? 'token_expired'
          : 'invalid_token';
      this.rejectClient(client, reason);
    }
  }

  handleDisconnect(client: Socket): void {
    const meta = this.clients.get(client.id);
    this.clients.delete(client.id);

    if (meta) {
      this.logger.debug(`User ${meta.userId} disconnected (${client.id})`);
    } else {
      const typedClient = client as AuthenticatedSocket;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const user = typedClient.data.user;
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.debug(`User ${user.userId} disconnected (${client.id})`);
      } else {
        this.logger.debug(`Anonymous socket ${client.id} disconnected`);
      }
    }
  }

  /**
   * Respond to client ping with server timestamp.
   * Updates last-heartbeat so the stale-cleanup job won't evict this socket.
   */
  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() _body: unknown,
    @ConnectedSocket() client: Socket,
  ): { event: string; timestamp: number } {
    const now = Date.now();
    const meta = this.clients.get(client.id);
    if (meta) {
      meta.lastHeartbeat = now;
    }
    return { event: 'pong', timestamp: now };
  }

  /**
   * Scheduled job: runs every 60 s, disconnects sockets whose last
   * heartbeat is older than `staleThresholdMs`.
   */
  @Interval(60_000)
  cleanupStaleConnections(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [socketId, meta] of this.clients) {
      if (now - meta.lastHeartbeat > this.staleThresholdMs) {
        const socket = this.server?.sockets?.sockets?.get(socketId);
        if (socket) {
          this.logger.warn(
            `Force-disconnecting stale socket ${socketId} (user ${meta.userId}, idle ${now - meta.lastHeartbeat} ms)`,
          );
          socket.disconnect(true);
        }
        this.clients.delete(socketId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(
        `Stale cleanup: removed ${cleaned} connection(s). Active: ${this.clients.size}`,
      );
    }
  }

  /**
   * Client opts into public bid-update broadcasts for a specific auction.
   */
  @SubscribeMessage('join_auction')
  handleJoinAuction(
    @MessageBody() body: { auctionId?: string } | undefined,
    @ConnectedSocket() client: Socket,
  ): { event: string; auctionId?: string; error?: string } {
    const auctionId = body?.auctionId;
    if (!auctionId) {
      return { event: 'join_auction:error', error: 'auctionId required' };
    }
    void client.join(auctionRoom(auctionId));
    this.clients.get(client.id)?.rooms.add(auctionRoom(auctionId));
    return { event: 'join_auction:ok', auctionId };
  }

  @SubscribeMessage('leave_auction')
  handleLeaveAuction(
    @MessageBody() body: { auctionId?: string } | undefined,
    @ConnectedSocket() client: Socket,
  ): { event: string; auctionId?: string; error?: string } {
    const auctionId = body?.auctionId;
    if (!auctionId) {
      return { event: 'leave_auction:error', error: 'auctionId required' };
    }
    void client.leave(auctionRoom(auctionId));
    this.clients.get(client.id)?.rooms.delete(auctionRoom(auctionId));
    return { event: 'leave_auction:ok', auctionId };
  }

  // ── private helpers ─────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    const query = client.handshake.query as
      Record<string, string | string[] | undefined> | undefined;
    if (query) {
      const raw = query.token;
      const q = Array.isArray(raw) ? raw[0] : raw;
      if (typeof q === 'string' && q.length > 0) return q;
    }

    const headerRaw =
      client.handshake.headers?.authorization ??
      client.handshake.headers?.Authorization;
    const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    if (typeof header === 'string' && header.length > 0) {
      return header.startsWith('Bearer ') ? header.slice(7) : header;
    }

    return null;
  }

  private rejectClient(client: Socket, reason: string): void {
    this.logger.warn(`Rejecting socket ${client.id}: ${reason}`);
    client.emit('auth_error', { reason });
    client.disconnect(true);
  }
}
