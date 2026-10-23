import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { PubSub } from 'graphql-subscriptions';
import {
  BID_PLACED_EVENT,
  type BidPlacedEvent,
} from '../../modules/bid/interfaces/bid.interface';
import { GraphqlBid } from '../types/auction.types';
import { PUB_SUB } from './pubsub.provider';
import { AUCTION_BID_PLACED_TOPIC } from './topics';

export type AuctionBidPlacedPayload = {
  auctionBidPlaced: GraphqlBid;
};

/**
 * Bridges the existing `bid.placed` event (emitted by BidService for every
 * bid-placement path — on-chain and GraphQL-only alike, see
 * bid.service.ts) onto the GraphQL `auctionBidPlaced` subscription (#650).
 * Keeping this as its own listener, rather than publishing inline from the
 * resolver, means every bid-placement path feeds the subscription without
 * BidService needing to know GraphQL subscriptions exist.
 */
@Injectable()
export class AuctionBidPublisher {
  private readonly logger = new Logger(AuctionBidPublisher.name);

  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @OnEvent(BID_PLACED_EVENT, { async: true })
  async handleBidPlaced(event: BidPlacedEvent): Promise<void> {
    const payload: AuctionBidPlacedPayload = {
      auctionBidPlaced: {
        id: event.bidId,
        auctionId: event.auctionId,
        bidderId: event.bidderId,
        amount: event.amountXlm,
        createdAt: event.timestamp,
      },
    };

    await this.pubSub.publish(AUCTION_BID_PLACED_TOPIC, payload);

    this.logger.debug(
      `Published auctionBidPlaced for auction ${event.auctionId} (bid ${event.bidId})`,
    );
  }
}
