// src/events/events.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { AuctionsService } from '../auctions/auctions.service';
import { BidsService } from '../bids/bids.service';

interface BidEventPayload {
  auctionId: string;
  bidId: string;
  amount: number;
  bidderId: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private server: Server;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly auctionsService: AuctionsService,
    @Inject('BIDS_SERVICE')
    private readonly bidsService: BidsService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  // Bid Events
  emitNewBid(payload: BidEventPayload) {
    this.eventEmitter.emit('bid.placed', payload);
    this.broadcastToAuctionRoom(`auction_${payload.auctionId}`, 'new_bid', {
      ...payload,
      timestamp: new Date().toISOString()
    });
  }

  // Auction Events
  async emitActiveAuctionsUpdate(client?: Socket) {
    try {
      const activeAuctions = await this.auctionsService.getActiveAuctions();
      const target = client ? client : this.server;
      target?.emit('active_auctions', activeAuctions);
    } catch (error) {
      this.logger.error('Active auctions update failed:', error.message);
    }
  }

  // Room Management
  async emitAuctionState(client: Socket, auctionId: string) {
    try {
      const [auction, bids, highestBid] = await Promise.all([
        this.auctionsService.getAuction(auctionId),
        this.bidsService.getBidsForAuction(auctionId),
        this.bidsService.getHighestBid(auctionId)
      ]);
      
      client.emit('auction_state', auction);
      client.emit('bid_history', bids);
      client.emit('highest_bid', highestBid);
    } catch (error) {
      this.logger.error(`Auction state error: ${error.message}`);
      client.emit('error', { message: 'Failed to load auction data' });
    }
  }

  // Private Utilities
  private broadcastToAuctionRoom(room: string, event: string, payload: any) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }
    this.server.to(room).emit(event, payload);
  }
}