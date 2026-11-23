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

  /**
   * Counts *distinct sessions* (not raw event counts — a session may enter
   * the same stage more than once) that reached each `payload.stage` value
   * for events named `eventName`, within `[from, to]`. Backs the funnel
   * drop-off dashboard (#662).
   */
  async countDistinctSessionsByStage(
    eventName: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, number>> {
    const results = await this.analyticsEventModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          eventName,
          receivedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$payload.stage',
          sessions: { $addToSet: '$context.sessionId' },
        },
      },
      {
        $project: {
          count: { $size: '$sessions' },
        },
      },
    ]);

    const byStage: Record<string, number> = {};
    for (const row of results) {
      if (row._id) {
        byStage[row._id] = row.count;
      }
    }
    return byStage;
  }
}
