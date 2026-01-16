import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StarknetService } from './starknet.service';
import { StarknetController } from './starknet.controller';
import { EventListenerService } from './listeners/event-listener.service';
import { MarketplaceEventListener } from './listeners/marketplace-event-listener';
import { AuctionEventListener } from './listeners/auction-event-listener';
import { TransactionEventListener } from './listeners/transaction-event-listener';
// Remove StarkNetEventsWorker for now since it has dependency issues
// import { StarkNetEventsWorker } from '../queues/starknet-events.worker';
import { CollectionsModule } from '../collections/collections.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    ConfigModule,
    // Comment out these imports temporarily to avoid circular dependencies
    // CollectionsModule,
    // AuctionsModule, 
    // TransactionsModule,
    // EventsModule,
  ],
  providers: [
    StarknetService,
    EventListenerService,
    MarketplaceEventListener,
    AuctionEventListener,
    TransactionEventListener,
    // Remove StarkNetEventsWorker temporarily
    // StarkNetEventsWorker,
  ],
  controllers: [StarknetController],
  exports: [
    StarknetService,
    EventListenerService,
  ],
})
export class StarknetModule {}