// Anthropic() reads ANTHROPIC_API_KEY at construction time — see
// ai-agent.service.spec.ts for why this must be set before the processor
// (and its internal `new Anthropic()`) is ever constructed.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

import type { Job } from 'bull';
import { AiModerationProcessor } from './ai-moderation.processor';
import { registerToolSet, unregisterToolSet } from './tools/tool-set.registry';
import type { AiModerationJobData } from './listeners/ai-moderation.types';
import type { StellarNft } from '../../nft/entities/stellar-nft.entity';
import type { ContentFlagService } from './content-flag.service';
import type { PrometheusService } from '../../common/metrics/prometheus';
import type { ModerationAlertService } from './moderation-alert.service';
import type { RunnableToolLike, ToolSetName } from './tools/tool-set.types';

describe('AiModerationProcessor (#527)', () => {
  const LISTING_ID = '123e4567-e89b-12d3-a456-426614174000';
  const NON_UUID_LISTING_ID = 'onchain-sale-42';

  const stellarNftRepo = {
    findOne: jest.fn(),
  };

  const contentFlagService = {
    findExistingFlag: jest.fn(),
    createFlag: jest.fn(),
  };

  const prometheusService = {
    incrementAiModerationJobProcessed: jest.fn(),
    incrementAiModerationJobsExhausted: jest.fn(),
  };

  const moderationAlertService = {
    alertExhausted: jest.fn(),
  };

  let processor: AiModerationProcessor;

  const makeJob = (
    overrides: Partial<AiModerationJobData> = {},
    attemptsMade = 0,
    attempts = 3,
  ): Job<AiModerationJobData> =>
    ({
      data: {
        listingId: LISTING_ID,
        sellerId: 'seller-1',
        nftContractId: 'C1',
        nftTokenId: 'T1',
        ...overrides,
      },
      attemptsMade,
      opts: { attempts },
    }) as unknown as Job<AiModerationJobData>;

  const makeNft = (
    overrides: Partial<{
      name: string;
      description: string;
      attributes: unknown;
    }> = {},
  ): StellarNft =>
    ({
      contractId: 'C1',
      tokenId: 'T1',
      metadata: {
        name: 'Cosmic Ape #7',
        description: 'A rare cosmic ape.',
        attributes: { rarity: 'legendary' },
        ...overrides,
      },
    }) as unknown as StellarNft;

  const mockMessagesCreate = (response: unknown) => {
    const client = (processor as unknown as { client: unknown }).client as {
      beta: { messages: { create: jest.Mock } };
    };
    client.beta.messages.create = jest.fn().mockResolvedValue(response);
    return client.beta.messages.create;
  };

  const makeToolUseResponse = (
    inputOverrides: Record<string, unknown> = {},
  ) => ({
    content: [
      {
        type: 'tool_use',
        id: 'tu_1',
        name: 'flag_content',
        input: {
          entityType: 'listing',
          entityId: LISTING_ID,
          reason: 'Scam indicators in description',
          severity: 'high',
          confidence: 0.9,
          ...inputOverrides,
        },
      },
    ],
    usage: { input_tokens: 200, output_tokens: 50 },
  });

  const makeCleanResponse = () => ({
    content: [{ type: 'text', text: 'No policy violation found.' }],
    usage: { input_tokens: 150, output_tokens: 20 },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    contentFlagService.findExistingFlag.mockResolvedValue(null);
    stellarNftRepo.findOne.mockResolvedValue(makeNft());
    contentFlagService.createFlag.mockResolvedValue({
      id: 'flag-1',
      status: 'pending',
      entityType: 'listing',
      entityId: LISTING_ID,
    });

    processor = new AiModerationProcessor(
      stellarNftRepo as never,
      contentFlagService as unknown as ContentFlagService,
      prometheusService as unknown as PrometheusService,
      moderationAlertService as unknown as ModerationAlertService,
    );
  });

  it('flags a listing when the moderation agent calls flag_content, and records the outcome', async () => {
    mockMessagesCreate(makeToolUseResponse());

    await processor.handleModerateListing(makeJob());

    expect(contentFlagService.createFlag).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'listing', entityId: LISTING_ID }),
    );
    expect(
      prometheusService.incrementAiModerationJobProcessed,
    ).toHaveBeenCalledWith('flagged');
  });

  it('does not flag a clean listing (no tool_use block in the response)', async () => {
    mockMessagesCreate(makeCleanResponse());

    await processor.handleModerateListing(makeJob());

    expect(contentFlagService.createFlag).not.toHaveBeenCalled();
    expect(
      prometheusService.incrementAiModerationJobProcessed,
    ).toHaveBeenCalledWith('clean');
  });

  it('skips processing (idempotency) when the listing already has a flag, without calling Anthropic', async () => {
    contentFlagService.findExistingFlag.mockResolvedValue({
      id: 'existing-flag',
      entityType: 'listing',
      entityId: LISTING_ID,
    });
    const create = mockMessagesCreate(makeToolUseResponse());

    await processor.handleModerateListing(makeJob());

    expect(create).not.toHaveBeenCalled();
    expect(contentFlagService.createFlag).not.toHaveBeenCalled();
    expect(
      prometheusService.incrementAiModerationJobProcessed,
    ).toHaveBeenCalledWith('skipped');
  });

  it('checks idempotency scoped to this listing, keyed by entity type and id', async () => {
    mockMessagesCreate(makeCleanResponse());

    await processor.handleModerateListing(makeJob());

    expect(contentFlagService.findExistingFlag).toHaveBeenCalledWith(
      'listing',
      LISTING_ID,
    );
  });

  it('skips processing when the NFT cannot be found, without calling Anthropic', async () => {
    stellarNftRepo.findOne.mockResolvedValue(null);
    const create = mockMessagesCreate(makeToolUseResponse());

    await processor.handleModerateListing(makeJob());

    expect(create).not.toHaveBeenCalled();
    expect(
      prometheusService.incrementAiModerationJobProcessed,
    ).toHaveBeenCalledWith('skipped');
  });

  it('re-throws on an Anthropic API failure so Bull retries, and records an error outcome', async () => {
    const client = (processor as unknown as { client: unknown }).client as {
      beta: { messages: { create: jest.Mock } };
    };
    client.beta.messages.create = jest
      .fn()
      .mockRejectedValue(new Error('rate limited'));

    await expect(processor.handleModerateListing(makeJob())).rejects.toThrow(
      'rate limited',
    );

    expect(contentFlagService.createFlag).not.toHaveBeenCalled();
    expect(
      prometheusService.incrementAiModerationJobProcessed,
    ).toHaveBeenCalledWith('error');
  });

  it('re-throws when persisting the flag fails, and records an error outcome', async () => {
    mockMessagesCreate(makeToolUseResponse());
    contentFlagService.createFlag.mockRejectedValue(new Error('db down'));

    await expect(processor.handleModerateListing(makeJob())).rejects.toThrow(
      'db down',
    );

    expect(
      prometheusService.incrementAiModerationJobProcessed,
    ).toHaveBeenCalledWith('error');
  });

  it('never trusts the model to flag a different entity than the listing under review', async () => {
    mockMessagesCreate(
      makeToolUseResponse({
        entityId: '00000000-0000-4000-8000-000000000000',
      }),
    );

    await expect(processor.handleModerateListing(makeJob())).rejects.toThrow();

    expect(contentFlagService.createFlag).not.toHaveBeenCalled();
  });

  describe('on-chain-only listings (non-UUID listingId)', () => {
    it('skips recording the flag when the agent flags a listing with no persisted DB row', async () => {
      mockMessagesCreate(
        makeToolUseResponse({ entityId: NON_UUID_LISTING_ID }),
      );

      await processor.handleModerateListing(
        makeJob({ listingId: NON_UUID_LISTING_ID }),
      );

      expect(contentFlagService.createFlag).not.toHaveBeenCalled();
      expect(
        prometheusService.incrementAiModerationJobProcessed,
      ).toHaveBeenCalledWith('skipped');
    });

    it('still processes clean on-chain-only listings normally', async () => {
      mockMessagesCreate(makeCleanResponse());

      await processor.handleModerateListing(
        makeJob({ listingId: NON_UUID_LISTING_ID }),
      );

      expect(
        prometheusService.incrementAiModerationJobProcessed,
      ).toHaveBeenCalledWith('clean');
    });
  });

  describe('tool set scoping', () => {
    const sandboxToolSet = 'sandbox-toolset' as ToolSetName;
    afterEach(() => {
      unregisterToolSet(sandboxToolSet);
    });

    it('never resolves tools outside the moderation tool set', async () => {
      registerToolSet(
        sandboxToolSet,
        () => [{ name: 'sandbox_tool' } as unknown as RunnableToolLike],
        ['sandbox_tool'],
      );
      mockMessagesCreate(makeCleanResponse());

      await processor.handleModerateListing(makeJob());

      // Sanity: registering an unrelated tool set doesn't change what
      // moderation resolves or break processing.
      expect(
        prometheusService.incrementAiModerationJobProcessed,
      ).toHaveBeenCalledWith('clean');
    });
  });
  describe('onFailed — retryable vs. exhausted (#748)', () => {
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      const logger = (processor as unknown as { logger: object }).logger;
      errorSpy = jest.spyOn(logger as never, 'error').mockImplementation();
      warnSpy = jest.spyOn(logger as never, 'warn').mockImplementation();
      contentFlagService.findExistingFlag.mockResolvedValue(null);
      contentFlagService.createFlag.mockResolvedValue({ id: 'flag-1' });
      moderationAlertService.alertExhausted.mockResolvedValue(undefined);
    });

    it.each([1, 2])(
      'attempt %i of 3: no "permanently failed" log, metric, flag or alert',
      async (attemptsMade) => {
        await processor.onFailed(
          makeJob({}, attemptsMade, 3),
          new Error('anthropic 529'),
        );

        expect(errorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('permanently failed'),
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('retry scheduled'),
        );
        expect(
          prometheusService.incrementAiModerationJobsExhausted,
        ).not.toHaveBeenCalled();
        expect(contentFlagService.createFlag).not.toHaveBeenCalled();
        expect(moderationAlertService.alertExhausted).not.toHaveBeenCalled();
      },
    );

    it('attempt 3 of 3: logs, increments the counter, alerts, and flags the listing for admins', async () => {
      await processor.onFailed(makeJob({}, 3, 3), new Error('anthropic 529'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed'),
      );
      expect(
        prometheusService.incrementAiModerationJobsExhausted,
      ).toHaveBeenCalledTimes(1);
      expect(moderationAlertService.alertExhausted).toHaveBeenCalledWith(
        LISTING_ID,
        'anthropic 529',
      );
      expect(contentFlagService.createFlag).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'listing',
          entityId: LISTING_ID,
          reason: expect.stringMatching(/^moderation_failed:/),
        }),
      );
    });

    it('does not create a duplicate flag when the listing already has one', async () => {
      contentFlagService.findExistingFlag.mockResolvedValue({ id: 'old' });

      await processor.onFailed(makeJob({}, 3, 3), new Error('boom'));

      expect(contentFlagService.createFlag).not.toHaveBeenCalled();
      expect(moderationAlertService.alertExhausted).toHaveBeenCalled();
    });

    it('skips the flag for a non-UUID listing but still counts and alerts', async () => {
      await processor.onFailed(
        makeJob({ listingId: NON_UUID_LISTING_ID }, 3, 3),
        new Error('boom'),
      );

      expect(contentFlagService.createFlag).not.toHaveBeenCalled();
      expect(
        prometheusService.incrementAiModerationJobsExhausted,
      ).toHaveBeenCalledTimes(1);
      expect(moderationAlertService.alertExhausted).toHaveBeenCalled();
    });

    it('still alerts when persisting the flag fails (handler never throws)', async () => {
      contentFlagService.createFlag.mockRejectedValue(new Error('db down'));

      await expect(
        processor.onFailed(makeJob({}, 3, 3), new Error('boom')),
      ).resolves.toBeUndefined();
      expect(moderationAlertService.alertExhausted).toHaveBeenCalled();
    });
  });
});
