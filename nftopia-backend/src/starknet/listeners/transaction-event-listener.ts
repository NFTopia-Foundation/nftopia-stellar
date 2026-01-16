import { Injectable } from '@nestjs/common';
import { BaseEventListener, EventFilter } from './base-event-listener';
import { getBlockchainConfig } from '../../config/blockchain.config';

@Injectable()
export class TransactionEventListener extends BaseEventListener {
  constructor() {
    const config = getBlockchainConfig();
    super(
      config.starknet.contractAddresses.nft,
      [],
      'transaction'
    );
  }

  protected getEventFilters(): EventFilter[] {
    return [
      { eventName: 'Transfer' },
      { eventName: 'Approval' },
    ];
  }

  protected async processEvent(event: any): Promise<{ eventName: string; data: any } | null> {
    try {
      this.logger.log(`Transaction event detected:`, {
        blockNumber: event.block_number,
        transactionHash: event.transaction_hash,
        keys: event.keys,
        data: event.data,
      });
      
      return {
        eventName: 'TransactionEvent',
        data: {
          keys: event.keys,
          data: event.data,
          blockNumber: event.block_number,
          transactionHash: event.transaction_hash,
        }
      };
    } catch (error) {
      this.logger.error(`Failed to process transaction event: ${error.message}`);
      return null;
    }
  }
}