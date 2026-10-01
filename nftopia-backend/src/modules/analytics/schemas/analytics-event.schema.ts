import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

/**
 * How long an analytics event document is retained before MongoDB's TTL
 * monitor automatically deletes it — see docs/mongodb-analytics.md for the
 * full retention policy and how to change this safely (it drives a TTL
 * index, so changing the value alone doesn't retroactively rebuild it).
 */
export const ANALYTICS_EVENT_RETENTION_DAYS = 90;
const ANALYTICS_EVENT_TTL_SECONDS =
  ANALYTICS_EVENT_RETENTION_DAYS * 24 * 60 * 60;

/**
 * Client-supplied context envelope. Mirrors nftopia-frontend's
 * `EnrichedTelemetryEvent.context` shape (lib/telemetry/context/types.ts)
 * field-for-field, so a future ingestion endpoint can persist what the
 * frontend's telemetry client already sends with no translation layer.
 */
@Schema({ _id: false })
export class AnalyticsEventContext {
  /** ISO-8601 timestamp set by the client at event creation time. */
  @Prop({ required: true })
  timestamp: string;

  @Prop({ required: true })
  route: string;

  @Prop({ required: true })
  locale: string;

  @Prop({ required: true, index: true })
  sessionId: string;

  @Prop({ required: true })
  deviceType: string;

  @Prop({ required: true })
  appSurface: string;

  @Prop()
  anonymousId?: string;

  @Prop({ index: true })
  userId?: string;

  @Prop()
  referrerRoute?: string;
}

export const AnalyticsEventContextSchema = SchemaFactory.createForClass(
  AnalyticsEventContext,
);

/**
 * A single analytics/event record — the initial MongoDB collection this
 * issue provisions (#531). Deliberately schema-light: `payload` is
 * `Mixed` because different event names carry different, evolving shapes
 * (see nftopia-frontend's `TelemetryPayloadMap`), which is exactly the
 * flexibility a relational table can't give without either a wide
 * nullable-column table or a migration per new event field. `eventName`
 * and `context` are the only fields every event is guaranteed to have, so
 * those are the only ones enforced/indexed here.
 */
@Schema({
  collection: 'analytics_events',
  versionKey: false,
  // Mongoose's default `minimize: true` strips any path that resolves to
  // an empty plain object before saving — which would silently turn the
  // documented "payload defaults to {}" guarantee into "payload defaults
  // to undefined" for the (common) case of an event with no extra fields.
  minimize: false,
})
export class AnalyticsEvent {
  @Prop({ required: true, index: true })
  eventName: string;

  @Prop({ type: AnalyticsEventContextSchema, required: true })
  context: AnalyticsEventContext;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, unknown>;

  /**
   * Server-side ingestion time (distinct from `context.timestamp`, which
   * is client-clock and untrusted) — this is what the TTL index below
   * actually keys retention off of.
   */
  @Prop({
    type: Date,
    required: true,
    default: () => new Date(),
    expires: ANALYTICS_EVENT_TTL_SECONDS,
  })
  receivedAt: Date;
}

export type AnalyticsEventDocument = HydratedDocument<AnalyticsEvent>;
export const AnalyticsEventSchema =
  SchemaFactory.createForClass(AnalyticsEvent);
