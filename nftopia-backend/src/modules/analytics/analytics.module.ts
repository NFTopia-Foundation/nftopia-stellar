import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';
import { CollectionStats } from './entities/collection-stats.entity.js';
import { Order } from '../order/entities/order.entity.js';
import { Nft } from '../nft/entities/nft.entity.js';
import { Listing } from '../listing/entities/listing.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollectionStats, Order, Nft, Listing]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
