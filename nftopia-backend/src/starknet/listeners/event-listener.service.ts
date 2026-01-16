import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { MarketplaceEventListener } from './marketplace-event-listener';
import { AuctionEventListener } from './auction-event-listener';
import { TransactionEventListener } from './transaction-event-listener';

@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventListenerService.name);
  private listeners: Array<MarketplaceEventListener | AuctionEventListener | TransactionEventListener> = [];

  constructor(
    private readonly marketplaceListener: MarketplaceEventListener,
    private readonly auctionListener: AuctionEventListener,
    private readonly transactionListener: TransactionEventListener,
  ) {
    this.listeners = [marketplaceListener, auctionListener, transactionListener];
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Starting StarkNet event listeners...');
    
    try {
      await Promise.all(
        this.listeners.map(listener => listener.startListening())
      );
      this.logger.log('All event listeners started successfully');
    } catch (error) {
      this.logger.error('Failed to start event listeners:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Stopping StarkNet event listeners...');
    
    await Promise.all(
      this.listeners.map(listener => listener.stopListening())
    );
    
    this.logger.log('All event listeners stopped');
  }

  getHealthStatus() {
    return {
      listeners: this.listeners.map(listener => listener.getHealthStatus()),
      totalListeners: this.listeners.length,
      allListening: this.listeners.every(listener => listener.getHealthStatus().isListening),
    };
  }

  async restartListener(eventType: 'marketplace' | 'auction' | 'transaction'): Promise<void> {
    const listener = this.listeners.find(l => l.getHealthStatus().eventType === eventType);
    if (listener) {
      await listener.stopListening();
      await listener.startListening();
      this.logger.log(`Restarted ${eventType} listener`);
    }
  }
}