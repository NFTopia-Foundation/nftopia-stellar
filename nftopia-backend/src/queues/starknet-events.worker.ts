import { Worker } from 'bullmq';
import { redisClient } from '../config/redis.config';
import { StarkNetEventData } from './starknet-events.queue';
import { Injectable, Logger } from '@nestjs/common';
// Remove Sentry import since it's causing issues - we can add it back later
// import * as Sentry from '@sentry/node';

@Injectable()
export class StarkNetEventsWorker {
  private readonly logger = new Logger(StarkNetEventsWorker.name);
  private worker: Worker;

  constructor(
    private readonly collectionsService: any, // Inject your services
    private readonly auctionsService: any,
    private readonly transactionsService: any,
    private readonly eventsService: any,
  ) {
    this.worker = new Worker<StarkNetEventData>(
      'starknet-events',
      async (job) => this.processEvent(job.data),
      {
        connection: redisClient,
        concurrency: 10,
        limiter: {
          max: 100,
          duration: 1000,
        },
      }
    );

    this.setupEventHandlers();
  }

  private async processEvent(eventData: StarkNetEventData): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing ${eventData.eventType} event: ${eventData.eventName}`);

      switch (eventData.eventType) {
        case 'marketplace':
          await this.processMarketplaceEvent(eventData);
          break;
        case 'auction':
          await this.processAuctionEvent(eventData);
          break;
        case 'transaction':
          await this.processTransactionEvent(eventData);
          break;
        default:
          throw new Error(`Unknown event type: ${eventData.eventType}`);
      }

      // Store processed event
      await this.eventsService.storeProcessedEvent(eventData);

      const processingTime = Date.now() - startTime;
      this.logger.log(`Event processed in ${processingTime}ms`);

      // Alert if processing time exceeds 500ms
      if (processingTime > 500) {
        this.logger.warn(`Slow event processing: ${processingTime}ms for ${eventData.eventName}`);
      }

    } catch (error) {
      this.logger.error(`Failed to process event: ${error.message}`, eventData);
      // Temporarily comment out Sentry until dependency is resolved
      // Sentry.captureException(error, {
      //   tags: {
      //     eventType: eventData.eventType,
      //     eventName: eventData.eventName,
      //   },
      //   extra: eventData,
      // });
      throw error;
    }
  }

  private async processMarketplaceEvent(eventData: StarkNetEventData): Promise<void> {
    switch (eventData.eventName) {
      case 'ListingCreated':
        await this.collectionsService.handleListingCreated(eventData.eventData);
        break;
      case 'Sale':
        await this.collectionsService.handleSale(eventData.eventData);
        await this.transactionsService.recordOnChainTransaction(eventData.eventData);
        break;
      case 'ListingCancelled':
        await this.collectionsService.handleListingCancelled(eventData.eventData);
        break;
    }
  }

  private async processAuctionEvent(eventData: StarkNetEventData): Promise<void> {
    switch (eventData.eventName) {
      case 'AuctionCreated':
        await this.auctionsService.handleAuctionCreated(eventData.eventData);
        break;
      case 'BidPlaced':
        await this.auctionsService.handleBidPlaced(eventData.eventData);
        // Emit real-time event
        this.eventsService.emitNewBid({
          auctionId: eventData.eventData.auctionId,
          bidId: eventData.eventData.bidder,
          amount: eventData.eventData.amount,
          bidderId: eventData.eventData.bidder,
        });
        break;
      case 'AuctionEnded':
        await this.auctionsService.handleAuctionEnded(eventData.eventData);
        break;
    }
  }

  private async processTransactionEvent(eventData: StarkNetEventData): Promise<void> {
    switch (eventData.eventName) {
      case 'Transfer':
        await this.transactionsService.handleNFTTransfer(eventData.eventData);
        break;
      case 'Approval':
        await this.transactionsService.handleNFTApproval(eventData.eventData);
        break;
    }
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      this.logger.log(`Event processing completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Event processing failed: ${job?.id}`, err);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Event processing stalled: ${jobId}`);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}