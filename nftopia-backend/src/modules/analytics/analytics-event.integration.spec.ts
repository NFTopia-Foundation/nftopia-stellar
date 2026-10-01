import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { AnalyticsEventService } from './analytics-event.service';
import {
  ANALYTICS_EVENT_RETENTION_DAYS,
  AnalyticsEvent,
  AnalyticsEventDocument,
  AnalyticsEventSchema,
} from './schemas/analytics-event.schema';

/**
 * Real end-to-end coverage against an actual MongoDB instance (#531's
 * "minimal integration test confirming a document can be written and
 * read back" requirement) — not a mocked Model, unlike
 * analytics-event.service.spec.ts. Uses mongodb-memory-server rather than
 * a docker-compose dependency so this runs as a normal `npm test` file
 * with no external service required; if a local `mongod` binary is
 * available (e.g. via MONGOMS_SYSTEM_BINARY), it's reused instead of
 * downloading one.
 */
describe('AnalyticsEventService (integration, #531)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let model: Model<AnalyticsEventDocument>;
  let service: AnalyticsEventService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({
      // The default 10s launch timeout is comfortably enough in isolation,
      // but can be exceeded under `npm test`'s full-suite parallelism
      // (many Jest workers contending for CPU/IO at once slows down the
      // in-memory mongod's own startup) — raised to keep this test stable
      // under that load rather than under isolation only.
      instance: { launchTimeout: 30_000 },
    });
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    // Untyped .model() call, same as what @nestjs/mongoose's own
    // InjectModel does under the hood — forcing the <AnalyticsEventDocument>
    // generic here trips a structural mismatch between Mongoose's inferred
    // document type and the HydratedDocument alias used everywhere else.
    model = connection.model(
      AnalyticsEvent.name,
      AnalyticsEventSchema,
    ) as unknown as Model<AnalyticsEventDocument>;
    // Waits for index creation (including the TTL index) to finish, so the
    // "declares a TTL index" test below isn't racing collection setup.
    await model.init();
    service = new AnalyticsEventService(model);
  }, 60_000);

  afterAll(async () => {
    await connection?.close();
    await mongod?.stop();
    // Default 5s hook timeout is too tight under full-suite parallelism —
    // see the launchTimeout comment above for why.
  }, 30_000);

  afterEach(async () => {
    await model.deleteMany({});
  });

  it('writes an analytics event and reads it back with all fields intact', async () => {
    const saved = await service.record({
      eventName: 'wallet_connect_succeeded',
      context: {
        timestamp: '2026-01-01T00:00:00.000Z',
        route: '/marketplace',
        locale: 'en',
        sessionId: 'session-abc',
        deviceType: 'desktop',
        appSurface: 'marketplace',
        userId: 'user-1',
      },
      payload: { provider: 'freighter', latency_ms: 420 },
    });

    const found = await model.findById(saved._id).lean();

    expect(found).not.toBeNull();
    expect(found?.eventName).toBe('wallet_connect_succeeded');
    expect(found?.context.sessionId).toBe('session-abc');
    expect(found?.context.userId).toBe('user-1');
    expect(found?.payload).toEqual({ provider: 'freighter', latency_ms: 420 });
    expect(found?.receivedAt).toBeInstanceOf(Date);
  });

  it('defaults payload to {} when none is given', async () => {
    const saved = await service.record({
      eventName: 'auth_login_succeeded',
      context: {
        timestamp: '2026-01-01T00:00:00.000Z',
        route: '/login',
        locale: 'en',
        sessionId: 'session-xyz',
        deviceType: 'mobile',
        appSurface: 'auth',
      },
    });

    const found = await model.findById(saved._id).lean();
    expect(found?.payload).toEqual({});
  });

  it('findRecentByEventName returns matching events newest first', async () => {
    const olderTimestamp = new Date('2026-01-01T00:00:00.000Z');
    const newerTimestamp = new Date('2026-01-02T00:00:00.000Z');
    const context = {
      timestamp: '2026-01-01T00:00:00.000Z',
      route: '/marketplace',
      locale: 'en',
      sessionId: 'session-1',
      deviceType: 'desktop',
      appSurface: 'marketplace',
    };

    await model.create({
      eventName: 'mint_nft_succeeded',
      context,
      payload: { nft_id: 'older' },
      receivedAt: olderTimestamp,
    });
    await model.create({
      eventName: 'mint_nft_succeeded',
      context,
      payload: { nft_id: 'newer' },
      receivedAt: newerTimestamp,
    });
    await model.create({
      eventName: 'listing_create_succeeded',
      context,
      payload: { listing_id: 'unrelated' },
      receivedAt: newerTimestamp,
    });

    const results = await service.findRecentByEventName('mint_nft_succeeded');

    expect(results).toHaveLength(2);
    expect(results[0].payload).toEqual({ nft_id: 'newer' });
    expect(results[1].payload).toEqual({ nft_id: 'older' });
  });

  it('declares a TTL index on receivedAt matching the documented retention window', async () => {
    const indexes = await model.collection.indexes();
    const ttlIndex = indexes.find(
      (index) =>
        index.key &&
        Object.prototype.hasOwnProperty.call(index.key, 'receivedAt'),
    );

    expect(ttlIndex).toBeDefined();
    expect(ttlIndex?.expireAfterSeconds).toBe(
      ANALYTICS_EVENT_RETENTION_DAYS * 24 * 60 * 60,
    );
  });
});
