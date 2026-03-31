/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Server, Socket } from 'socket.io';
import {
  BID_PLACED_EVENT,
  type BidPlacedEvent,
} from './interfaces/bid.interface';

/**
 * BidGateway
 *
 * Real-time WebSocket gateway for bid events.
 *
 * Clients connect to `ws://<host>/bids` and can join auction rooms to receive
 * instant bid updates without polling.
 *
 * Client usage:
 *   const socket = io('/bids');
 *   socket.emit('join-auction', { auctionId: '<uuid>' });
 *   socket.on('bid-placed', (bid) => console.log(bid));
 *   // On leave:
 *   socket.emit('leave-auction', { auctionId: '<uuid>' });
 */
@WebSocketGateway({
  namespace: '/bids',
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class BidGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(BidGateway.name);

  afterInit(): void {
    this.logger.log('BidGateway WebSocket server initialised');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${String(client.id)}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${String(client.id)}`);
  }

  // ─── Room management ──────────────────────────────────────────────────────

  @SubscribeMessage('join-auction')
  handleJoinAuction(
    @MessageBody() data: { auctionId: string },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { auctionId: string } } {
    const room = `auction:${data.auctionId}`;
    void client.join(room);
    this.logger.debug(`${String(client.id)} joined room ${room}`);
    return { event: 'joined', data: { auctionId: data.auctionId } };
  }

  @SubscribeMessage('leave-auction')
  handleLeaveAuction(
    @MessageBody() data: { auctionId: string },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { auctionId: string } } {
    const room = `auction:${data.auctionId}`;
    void client.leave(room);
    this.logger.debug(`${String(client.id)} left room ${room}`);
    return { event: 'left', data: { auctionId: data.auctionId } };
  }

  // ─── Event bridge ─────────────────────────────────────────────────────────

  /**
   * Listens for the internal `bid.placed` event and broadcasts it to all
   * Socket.IO clients subscribed to the relevant auction room.
   */
  @OnEvent(BID_PLACED_EVENT)
  handleBidPlacedEvent(payload: BidPlacedEvent): void {
    const room = `auction:${payload.auctionId}`;
    this.server.to(room).emit('bid-placed', {
      auctionId: payload.auctionId,
      bidderId: payload.bidderId,
      amount: payload.amount,
      amountXlm: payload.amountXlm,
      txHash: payload.txHash,
      ledgerSequence: payload.ledgerSequence,
      sorobanStatus: payload.sorobanStatus,
      timestamp: payload.timestamp,
    });

    this.logger.debug(
      `Broadcast bid-placed to room ${room}: ${payload.amountXlm} XLM`,
    );
  }
}
