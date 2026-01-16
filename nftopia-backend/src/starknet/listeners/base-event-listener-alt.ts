import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RpcProvider, Contract, num } from 'starknet';
import { CircuitBreaker } from './circuit-breaker';
import { starknetEventsQueue, StarkNetEventData } from '../../queues/starknet-events.queue';
import { getBlockchainConfig } from '../../config/blockchain.config';

export interface EventFilter {
  eventName: string;
  fromBlock?: number;
  toBlock?: number;
  keys?: string[];
}

@Injectable()
export abstract class BaseEventListener implements OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  protected provider: RpcProvider;
  protected contract: Contract;
  protected circuitBreaker: CircuitBreaker;
  protected isListening = false;
  protected lastProcessedBlock = 0;
  private intervalId?: NodeJS.Timeout;

  constructor(
    protected readonly contractAddress: string,
    protected readonly contractAbi: any[],
    protected readonly eventType: 'marketplace' | 'auction' | 'transaction',
  ) {
    const config = getBlockchainConfig();
    this.provider = new RpcProvider({ nodeUrl: config.starknet.rpcUrl });
    this.contract = new Contract(contractAbi, contractAddress, this.provider);
    this.circuitBreaker = new CircuitBreaker(
      config.starknet.eventListener.circuitBreakerThreshold,
      config.starknet.eventListener.circuitBreakerTimeout,
    );
    this.lastProcessedBlock = config.starknet.eventListener.startBlock;
  }

  async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('Event listener is already running');
      return;
    }

    this.isListening = true;
    this.logger.log(`Starting event listener for ${this.eventType} contract: ${this.contractAddress}`);

    const config = getBlockchainConfig();
    this.intervalId = setInterval(
      () => this.pollEvents(),
      config.starknet.eventListener.pollingInterval,
    );
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.logger.log(`Stopped event listener for ${this.eventType}`);
  }

  private async pollEvents(): Promise<void> {
    if (!this.isListening) return;

    try {
      await this.circuitBreaker.execute(async () => {
        const currentBlock = await this.provider.getBlockNumber();
        const config = getBlockchainConfig();
        
        const toBlock = Math.min(
          currentBlock,
          this.lastProcessedBlock + config.starknet.eventListener.batchSize
        );

        if (this.lastProcessedBlock >= toBlock) {
          return; // No new blocks to process
        }

        const events = await this.getEventsAlternative({
          fromBlock: this.lastProcessedBlock + 1,
          toBlock,
        });

        if (events.length > 0) {
          this.logger.log(`Processing ${events.length} events from blocks ${this.lastProcessedBlock + 1} to ${toBlock}`);
          await this.processEvents(events);
        }

        this.lastProcessedBlock = toBlock;
      });
    } catch (error) {
      this.logger.error(`Event polling failed: ${error.message}`);
      
      if (this.circuitBreaker.getState() === 'OPEN') {
        this.logger.warn('Circuit breaker is open, pausing event polling');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  // Alternative method using direct RPC calls
  protected async getEventsAlternative(filter: { fromBlock: number; toBlock: number }): Promise<any[]> {
    const allEvents: any[] = [];

    try {
      // Use the provider's direct method with proper parameters
      const events = await this.provider.getEvents({
        from_block: { block_number: filter.fromBlock },
        to_block: { block_number: filter.toBlock },
        address: this.contractAddress,
        chunk_size: 100,
      });

      if (events && events.events) {
        allEvents.push(...events.events);
      }
    } catch (error) {
      this.logger.error(`Failed to get events: ${error.message}`);
    }

    return allEvents;
  }

  protected async processEvents(events: any[]): Promise<void> {
    const processedEvents: StarkNetEventData[] = [];

    for (const event of events) {
      try {
        const processedEvent = await this.processEvent(event);
        if (processedEvent) {
          processedEvents.push({
            eventType: this.eventType,
            contractAddress: this.contractAddress,
            blockNumber: event.block_number,
            transactionHash: event.transaction_hash,
            eventName: processedEvent.eventName,
            eventData: processedEvent.data,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        this.logger.error(`Failed to process event: ${error.message}`, event);
      }
    }

    if (processedEvents.length > 0) {
      await Promise.all(
        processedEvents.map(eventData =>
          starknetEventsQueue.add('process-event', eventData, {
            priority: this.getEventPriority(eventData.eventName),
          })
        )
      );
    }
  }

  protected getEventPriority(eventName: string): number {
    const priorityMap: Record<string, number> = {
      'Transfer': 10,
      'Sale': 10,
      'BidPlaced': 8,
      'AuctionCreated': 6,
      'AuctionEnded': 10,
      'ListingCreated': 5,
      'ListingCancelled': 5,
    };
    return priorityMap[eventName] || 1;
  }

  // Abstract methods
  protected abstract getEventFilters(): EventFilter[];
  protected abstract processEvent(event: any): Promise<{ eventName: string; data: any } | null>;

  async onModuleDestroy(): Promise<void> {
    await this.stopListening();
  }

  getHealthStatus() {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      circuitBreaker: this.circuitBreaker.getStats(),
      contractAddress: this.contractAddress,
      eventType: this.eventType,
    };
  }
}