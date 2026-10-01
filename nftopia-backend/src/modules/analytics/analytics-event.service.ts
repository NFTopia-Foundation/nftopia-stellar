import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AnalyticsEvent,
  AnalyticsEventContext,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';

export interface RecordAnalyticsEventInput {
  eventName: string;
  context: AnalyticsEventContext;
  /** Defaults to {} — not every event carries additional fields. */
  payload?: Record<string, unknown>;
}

@Injectable()
export class AnalyticsEventService {
  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly analyticsEventModel: Model<AnalyticsEventDocument>,
  ) {}

  /**
   * Persists one analytics/event document. `receivedAt` is always set
   * server-side (never trusts a client-supplied ingestion time) — it's
   * what the collection's TTL index keys retention off of.
   */
  async record(
    input: RecordAnalyticsEventInput,
  ): Promise<AnalyticsEventDocument> {
    const created = new this.analyticsEventModel({
      eventName: input.eventName,
      context: input.context,
      payload: input.payload ?? {},
      receivedAt: new Date(),
    });
    return created.save();
  }

  /** Most recent events for a given event name, newest first. */
  async findRecentByEventName(
    eventName: string,
    limit = 20,
  ): Promise<AnalyticsEventDocument[]> {
    return this.analyticsEventModel
      .find({ eventName })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .exec();
  }
}
