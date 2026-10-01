// Anthropic() reads ANTHROPIC_API_KEY at construction time — see
// ai-agent.service.spec.ts for why this must be set before
// AiModerationProcessor (and its internal `new Anthropic()`) is
// constructed.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

import type { Job } from 'bull';
import { ListingCreatedListener } from './listeners/listing-created.listener';
import { AiModerationProcessor } from './ai-moderation.processor';
import { ContentFlagService } from './content-flag.service';
import type { ListingCreatedEvent } from './listeners/ai-moderation.types';
import type { AuditService } from '../../common/audit/audit.service';
import type { PrometheusService } from '../../common/metrics/prometheus';

/**
 * Exercises the real listener -> queue job -> processor -> ContentFlagService
 * chain end to end — #527's required "listing-created -> job processed ->
 * flag created" integration test.
 *
 * Not backed by a real Bull queue/Redis: this repo's Bull relies on Lua
 * scripts that ioredis-mock can't execute (missing cmsgpack support), and
 * CI has no Redis service configured, so a real-queue test would be
 * flaky/uncommittable. Instead — matching the pattern this codebase
 * already uses for its other queue processor (email.processor.spec.ts
 * calls EmailProcessor.handleSend with a hand-built Job rather than a
 * real queue) — the queue boundary is crossed by capturing exactly what
 * the listener hands Bull via `queue.add`, then feeding that same data to
 * the processor as Bull itself would on delivery. Everything on either
 * side of that boundary is real: the listener's own enqueue logic, and
 * the processor's real resolveToolSet/flag_content/ContentFlagService
 * chain (only the Anthropic API call and the NFT/audit repos are test
 * doubles). ContentFlagService runs against an in-memory fake
 * content_flags table, so `listFlags` — the same read path
 * GET /admin/ai/flags uses — observes the exact rows `createFlag` wrote.
 */
describe('listing.created -> ai-moderation queue -> ContentFlag (integration, #527)', () => {
  const event: ListingCreatedEvent = {
    listingId: '123e4567-e89b-12d3-a456-426614174000',
    sellerId: 'seller-1',
    nftContractId: 'C1',
    nftTokenId: 'T1',
  };

  const moderationQueue = { add: jest.fn() };
  let listener: ListingCreatedListener;

  let flagsTable: Array<Record<string, unknown>>;
  let nextFlagId: number;
  const contentFlagRepo = {
    create: (input: Record<string, unknown>) => ({ ...input }),
    save: (flag: Record<string, unknown>) => {
      const saved = {
        id: `flag-${nextFlagId++}`,
        createdAt: new Date(),
        ...flag,
      };
      flagsTable.push(saved);
      return Promise.resolve(saved);
    },
    findOne: ({ where }: { where: Record<string, unknown> }) => {
      const found =
        flagsTable.find((f) =>
          Object.entries(where).every(([k, v]) => f[k] === v),
        ) ?? null;
      return Promise.resolve(found);
    },
    createQueryBuilder: () => {
      let filtered = flagsTable;
      const qb = {
        andWhere: (_sql: string, params: Record<string, unknown>) => {
          const [key] = Object.keys(params);
          filtered = filtered.filter((f) => f[key] === params[key]);
          return qb;
        },
        orderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getCount: () => Promise.resolve(filtered.length),
        getMany: () => Promise.resolve(filtered),
      };
      return qb;
    },
  };

  const auditService = {
    logAdminAction: jest.fn().mockResolvedValue(undefined),
  };
  let contentFlagService: ContentFlagService;

  const stellarNftRepo = { findOne: jest.fn() };
  const prometheusService = { incrementAiModerationJobProcessed: jest.fn() };
  let processor: AiModerationProcessor;

  const mockMessagesCreate = (response: unknown) => {
    const client = (processor as unknown as { client: unknown }).client as {
      beta: { messages: { create: jest.Mock } };
    };
    client.beta.messages.create = jest.fn().mockResolvedValue(response);
  };

  const flaggingResponse = {
    content: [
      {
        type: 'tool_use',
        id: 'tu_1',
        name: 'flag_content',
        input: {
          entityType: 'listing',
          entityId: event.listingId,
          reason: 'Scam giveaway pattern in description',
          severity: 'high',
          confidence: 0.93,
        },
      },
    ],
    usage: { input_tokens: 180, output_tokens: 40 },
  };

  const cleanResponse = {
    content: [{ type: 'text', text: 'No policy violation found.' }],
    usage: { input_tokens: 150, output_tokens: 15 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    flagsTable = [];
    nextFlagId = 1;

    listener = new ListingCreatedListener(moderationQueue as never);
    contentFlagService = new ContentFlagService(
      contentFlagRepo as never,
      auditService as unknown as AuditService,
    );
    stellarNftRepo.findOne.mockResolvedValue({
      contractId: 'C1',
      tokenId: 'T1',
      metadata: {
        name: 'Cosmic Ape #7',
        description: 'Send 1 XLM, get 10 XLM back — limited giveaway!',
        attributes: {},
      },
    });
    processor = new AiModerationProcessor(
      stellarNftRepo as never,
      contentFlagService,
      prometheusService as unknown as PrometheusService,
    );
  });

  /** Enqueues via the real listener, then hands the captured job data back as Bull would on delivery. */
  const deliverEnqueuedJob = async (
    attemptsMade = 0,
  ): Promise<Job<ListingCreatedEvent>> => {
    await listener.handleListingCreated(event);
    const call = moderationQueue.add.mock.calls[
      moderationQueue.add.mock.calls.length - 1
    ] as [string, ListingCreatedEvent, { attempts?: number }];
    const [jobName, jobData, jobOpts] = call;
    expect(jobName).toBe('moderate-listing');
    return {
      data: jobData,
      attemptsMade,
      opts: jobOpts,
    } as unknown as Job<ListingCreatedEvent>;
  };

  it('creates a ContentFlag retrievable the same way GET /admin/ai/flags reads it', async () => {
    mockMessagesCreate(flaggingResponse);

    const job = await deliverEnqueuedJob();
    await processor.handleModerateListing(job);

    const { flags, total } = await contentFlagService.listFlags({
      status: 'pending',
    });
    expect(total).toBe(1);
    expect(flags[0]).toMatchObject({
      entityType: 'listing',
      entityId: event.listingId,
      status: 'pending',
      severity: 'high',
    });
  });

  it('does not create a flag for clean content', async () => {
    mockMessagesCreate(cleanResponse);

    const job = await deliverEnqueuedJob();
    await processor.handleModerateListing(job);

    const { total } = await contentFlagService.listFlags({});
    expect(total).toBe(0);
  });

  it('does not create a duplicate flag when the same job is redelivered', async () => {
    mockMessagesCreate(flaggingResponse);

    const job = await deliverEnqueuedJob();
    await processor.handleModerateListing(job);
    await processor.handleModerateListing(await deliverRedeliveredJob(job));

    const { total } = await contentFlagService.listFlags({});
    expect(total).toBe(1);
  });

  it('enqueues with bounded retry/backoff, so a transient failure retries rather than failing permanently', async () => {
    await listener.handleListingCreated(event);

    const [, , opts] = moderationQueue.add.mock.calls[0] as [
      string,
      ListingCreatedEvent,
      { attempts: number; backoff: unknown },
    ];
    expect(opts.attempts).toBe(3);
    expect(opts.backoff).toEqual({ type: 'exponential', delay: 5000 });
  });

  // Simulates Bull redelivering the same job (e.g. after a crash mid-attempt).
  function deliverRedeliveredJob(
    original: Job<ListingCreatedEvent>,
  ): Promise<Job<ListingCreatedEvent>> {
    return Promise.resolve({
      ...original,
      attemptsMade: original.attemptsMade + 1,
    } as Job<ListingCreatedEvent>);
  }
});
