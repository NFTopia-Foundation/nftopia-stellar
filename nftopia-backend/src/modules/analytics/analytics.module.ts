import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AnalyticsEvent,
  AnalyticsEventSchema,
} from './schemas/analytics-event.schema';
import { AnalyticsEventService } from './analytics-event.service';

/**
 * MongoDB-backed analytics/event storage (#531). Requires a root
 * MongooseModule.forRootAsync connection to already be registered
 * (see app.module.ts) — this module only registers the collection-level
 * model via forFeature.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
    ]),
  ],
  providers: [AnalyticsEventService],
  exports: [AnalyticsEventService],
})
export class AnalyticsModule {}
