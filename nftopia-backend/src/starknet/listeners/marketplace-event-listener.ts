import { Injectable } from '@nestjs/common';
import { BaseEventListener, EventFilter } from './base-event-listener';
import { getBlockchainConfig } from '../../config/blockchain.config';

@Injectable()
export class MarketplaceEventListener extends BaseEventListener {
  constructor() {
    const config = getBlockchainConfig();
    super(
      config.starknet.contractAddresses.marketplace,
      [], // Empty ABI for now
      'marketplace'
    );
  }

  protected getEventFilters(): EventFilter[] {
    return [
      { eventName: 'ListingCreated' },
      { eventName: 'Sale' },
      { eventName: 'ListingCancelled' },
    ];
  }

  protected async processEvent(event: any): Promise<{ eventName: string; data: any } | null> {
    try {
      this.logger.log(`Marketplace event detected:`, {
        blockNumber: event.block_number,
        transactionHash: event.transaction_hash,
        keys: event.keys,
        data: event.data,
      });
      
      return {
        eventName: 'MarketplaceEvent',
        data: {
          keys: event.keys,
          data: event.data,
          blockNumber: event.block_number,
          transactionHash: event.transaction_hash,
        }
      };
    } catch (error) {
      this.logger.error(`Failed to process marketplace event: ${error.message}`);
      return null;
    }
  }
}