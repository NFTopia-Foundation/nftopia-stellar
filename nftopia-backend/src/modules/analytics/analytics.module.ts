import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AnalyticsEvent,
  AnalyticsEventSchema,
} from './schemas/analytics-event.schema';
import { AnalyticsEventService } from './analytics-event.service';
import { AnalyticsIngestionController } from './analytics-ingestion.controller';
import { FunnelAnalyticsController } from './funnel-analytics.controller';

/**
 * MongoDB-backed analytics/event storage (#531). Requires a root
 * MongooseModule.forRootAsync connection to already be registered
 * (see app.module.ts) — this module only registers the collection-level
 * model via forFeature.
 *
 * Also provides the public ingestion endpoint and the admin-gated funnel
 * drop-off summary endpoint (#662).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
    ]),
  ],
  controllers: [AnalyticsIngestionController, FunnelAnalyticsController],
  providers: [AnalyticsEventService],
  exports: [AnalyticsEventService],
})
export class AnalyticsModule {}
