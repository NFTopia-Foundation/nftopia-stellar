// src/events/events.gateway.ts
import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from './events.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BidsService } from '../bids/bids.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
  credentials: true
})
@Injectable()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    @Inject()
    private readonly jwtService: JwtService,
    @Inject()
    private readonly eventsService: EventsService,

    @Inject()
    private readonly bidsService: BidsService
  ) {}

  afterInit() {
    this.eventsService.setServer(this.server);
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const authToken = client.handshake.headers.authorization?.split(' ')[1];
      if (!authToken) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(authToken);
      client.data.userId = payload.sub;
      this.logger.log(`Client connected: ${client.id}, User: ${payload.sub}`);
    } catch (error) {
      this.logger.error('Connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_auction')
  async handleJoinAuction(client: Socket, auctionId: string) {
    client.join(`auction_${auctionId}`);
    this.logger.log(`User ${client.data.userId} joined auction ${auctionId}`);
    await this.eventsService.emitAuctionState(client, auctionId);
  }

  @SubscribeMessage('watch_active_auctions')
  async handleWatchActiveAuctions(client: Socket) {
    await this.eventsService.emitActiveAuctionsUpdate(client);
  }

  @SubscribeMessage('place_bid')
async handlePlaceBid(client: Socket, data: { auctionId: string; amount: number; }) {
  const bidderId = client.data.userId;
  const bid = await this.bidsService.placeBid(bidderId, data.auctionId, data.amount);
  this.eventsService.emitNewBid({
    auctionId: data.auctionId,
    bidId: bid.id,
    amount: bid.amount,
    bidderId,
  });
}

}
