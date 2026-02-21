import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';

/** Socket.IO server type (from @nestjs/platform-socket.io). */
interface SocketIoServer {
  to(room: string): { emit: (event: string, payload: unknown) => void };
}

export const BIDS_NAMESPACE = '/bids';

export interface NewBidPayload {
  id: string;
  auctionId: string;
  bidderPublicKey: string;
  amountXlm: string;
  amountStroops: string;
  transactionHash: string;
  ledgerSequence: number;
  createdAt: Date;
}

@WebSocketGateway({
  namespace: BIDS_NAMESPACE,
  cors: { origin: '*' },
})
export class BidsGateway {
  @WebSocketServer()
  server!: SocketIoServer;

  private readonly logger = new Logger(BidsGateway.name);

  broadcastNewBid(auctionId: string, payload: NewBidPayload): void {
    this.server?.to(`auction:${auctionId}`).emit('bid_placed', payload);
    this.logger.debug(`Emitted bid_placed for auction ${auctionId}`);
  }

  @SubscribeMessage('subscribe_auction')
  handleSubscribe(client: { join: (room: string) => void }, payload: { auctionId: string }): void {
    if (payload?.auctionId) {
      client.join(`auction:${payload.auctionId}`);
    }
  }
}
