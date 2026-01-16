import { Injectable } from '@nestjs/common';
import { BaseEventListener, EventFilter } from './base-event-listener';
import { getBlockchainConfig } from '../../config/blockchain.config';

@Injectable()
export class AuctionEventListener extends BaseEventListener {
  constructor() {
    const config = getBlockchainConfig();
    super(
      config.starknet.contractAddresses.auction,
      [],
      'auction'
    );
  }

  protected getEventFilters(): EventFilter[] {
    return [
      { eventName: 'AuctionCreated' },
      { eventName: 'BidPlaced' },
      { eventName: 'AuctionEnded' },
    ];
  }

  protected async processEvent(event: any): Promise<{ eventName: string; data: any } | null> {
    try {
      this.logger.log(`Auction event detected:`, {
        blockNumber: event.block_number,
        transactionHash: event.transaction_hash,
        keys: event.keys,
        data: event.data,
      });
      
      return {
        eventName: 'AuctionEvent',
        data: {
          keys: event.keys,
          data: event.data,
          blockNumber: event.block_number,
          transactionHash: event.transaction_hash,
        }
      };
    } catch (error) {
      this.logger.error(`Failed to process auction event: ${error.message}`);
      return null;
    }
  }
}