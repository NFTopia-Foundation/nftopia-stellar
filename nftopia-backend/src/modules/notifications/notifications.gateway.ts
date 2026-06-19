import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

/**
 * JWT-authenticated WebSocket gateway that powers real-time notifications.
 *
 * ### Auth
 * The JWT token can be supplied via either:
 *   1. `auth` payload:     io({ auth: { token } })
 *   2. query parameter:    io('/notifications?token=...')
 *   3. `Authorization` hdr: extraHeaders: { Authorization: 'Bearer ...' }
 *
 * Invalid/missing tokens cause `handleConnection` to call `client.disconnect()`
 * with an explanatory `auth_error` payload. This mirrors the JwtStrategy
 * used for REST (same secret, same claims).
 *
 * ### Rooms
 * On successful auth the socket is added to `user:{userId}` so the
 * `NotificationsService.notifyUser()` helper can target a single user
 * without tracking socket ids. Clients may additionally join
 * `auction:{auctionId}` rooms via `join_auction` / `leave_auction`
 * messages to receive `bid_update` broadcasts.
 *
 * ### Message Size Limits
 * All incoming WebSocket messages are subject to a maximum size limit
 * (default: 64KB). Messages exceeding this limit are rejected and the
 * connection is terminated. The limit can be configured via the
 * `WEBSOCKET_MAX_MESSAGE_SIZE_BYTES` environment variable.
 *
 * ### Why a new gateway when BidGateway exists?
 * `BidGateway` is anonymous and auction-scoped — designed for public
 * price tickers. This gateway is *user*-scoped and authenticated, which
 * is what toast-style notifications (`New Bid`, `Item Sold`, etc.)
 * require. Keeping them separate keeps the auth boundary obvious.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e6, // Set to 1MB initially, will be overridden in afterInit
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Expose the underlying io.Server for the service to emit against. */
  getServer(): Server {
    return this.server;
  }

  afterInit(): void {
    const config = getNotificationsConfig(this.configService);
    
    // Check if server and engine exist before accessing opts
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

    // Add error handling for oversized messages
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
      this.logger.debug(
        `Client ${client.id} authenticated as user ${user.userId}`,
      );
      client.emit('connected', { userId: user.userId });
    } catch (err) {
      const reason =
        err instanceof Error && /expired/i.test(err.message)
          ? 'token_expired'
          : 'invalid_token';
      this.rejectClient(client, reason);
    }
  }

  handleDisconnect(client: Socket): void {
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

  /**
   * Client opts into public bid-update broadcasts for a specific auction.
   * Authentication is still required for this gateway; subscribing to a
   * public room doesn't change that.
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
    return { event: 'leave_auction:ok', auctionId };
  }

  // ── private helpers ─────────────────────────────────────────────────────

  /**
   * Extract the token in priority order: auth.token → query.token →
   * Authorization header (Bearer <token> | raw token).
   */
  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    const query = client.handshake.query as
      | Record<string, string | string[] | undefined>
      | undefined;
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