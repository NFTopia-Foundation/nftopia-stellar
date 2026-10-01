import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import type { Job } from 'bull';
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { ContentFlagService } from './content-flag.service';
import { PrometheusService } from '../../common/metrics/prometheus';
import { resolveToolSet } from './tools/tool-set.registry';
import {
  AI_MODERATION_QUEUE_NAME,
  MODERATE_LISTING_JOB,
  type AiModerationJobData,
} from './listeners/ai-moderation.types';
import type { ToolLogger } from './tools/tool-set.types';

const MODERATION_SYSTEM_PROMPT = `You are the NFTopia content moderation agent. Given an NFT \
listing's name, description, and attributes, decide whether it violates platform policy: \
prohibited or illegal content described in the text, scam or fraud indicators (e.g. \
impersonation, fake giveaways, phishing links), or claimed intellectual property infringement. \
Call flag_content ONLY when you find a genuine, describable violation in the given content — \
never flag content merely for being low-effort, unoriginal, or because you're uncertain. If you \
find no violation, reply with a brief plain-text note and do NOT call any tool. Base your \
decision only on the data given — never invent details not present in the listing.`;

interface ModeratableNftContent {
  name: string | null;
  description: string | null;
  attributes: unknown;
}

function buildModerationPrompt(content: ModeratableNftContent): string {
  return `Review this NFT listing for policy violations:\n${JSON.stringify(content, null, 2)}`;
}

/**
 * Consumes the `ai-moderation` Bull queue ListingCreatedListener enqueues
 * onto (#527). Resolves the 'moderation' tool set per job and makes a
 * single non-agentic call to Anthropic with `flag_content` available but
 * not forced — unlike AiAgentService.draftListing's forced tool_choice,
 * moderation must be free to conclude "no violation" and call nothing.
 */
@Injectable()
@Processor(AI_MODERATION_QUEUE_NAME)
export class AiModerationProcessor {
  private readonly logger = new Logger(AiModerationProcessor.name);
  private readonly client = new Anthropic();

  constructor(
    @InjectRepository(StellarNft)
    private readonly stellarNftRepo: Repository<StellarNft>,
    private readonly contentFlagService: ContentFlagService,
    private readonly prometheusService: PrometheusService,
  ) {}

  /**
   * Structured, DB-free logging for individual tool calls — deliberately
   * NOT persisted to ai_tool_call_logs like AiAgentService.getToolLogger:
   * that table's session_id is a required foreign key into chat_sessions,
   * and a moderation job has no chat session to attach to.
   */
  private readonly toolLogger: ToolLogger = (
    toolName,
    _args,
    resultSummary,
    durationMs,
  ) => {
    this.logger.log(
      `tool=${toolName} durationMs=${durationMs} result=${resultSummary}`,
    );
  };

  @Process(MODERATE_LISTING_JOB)
  async handleModerateListing(job: Job<AiModerationJobData>): Promise<void> {
    const { listingId, nftContractId, nftTokenId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts =
      typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;

    this.logger.log(
      `Processing moderation job for listing=${listingId} nft=${nftContractId}/${nftTokenId} ` +
        `(attempt ${attempt}/${maxAttempts})`,
    );

    // Idempotency guard (#527): skip a redelivered job whose listing has
    // already been flagged, before spending an Anthropic call on it.
    const existingFlag = await this.contentFlagService.findExistingFlag(
      'listing',
      listingId,
    );
    if (existingFlag) {
      this.logger.log(
        `Listing ${listingId} already has flag ${existingFlag.id} — skipping duplicate moderation.`,
      );
      this.prometheusService.incrementAiModerationJobProcessed('skipped');
      return;
    }

    const nft = await this.stellarNftRepo.findOne({
      where: { contractId: nftContractId, tokenId: nftTokenId },
      relations: ['metadata'],
    });
    if (!nft) {
      this.logger.warn(
        `Listing ${listingId}: NFT ${nftContractId}/${nftTokenId} not found — nothing to moderate.`,
      );
      this.prometheusService.incrementAiModerationJobProcessed('skipped');
      return;
    }

    const tools = resolveToolSet('moderation', {
      contentFlagService: this.contentFlagService,
      expectedEntity: { entityType: 'listing', entityId: listingId },
      toolLogger: this.toolLogger,
    });
    const flagContentTool = tools.find((t) => t.name === 'flag_content');
    if (!flagContentTool) {
      throw new Error(
        'moderation tool set is misconfigured: flag_content not found',
      );
    }

    const prompt = buildModerationPrompt({
      name: nft.metadata?.name ?? null,
      description: nft.metadata?.description ?? null,
      attributes: nft.metadata?.attributes ?? null,
    });

    let response: BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: 'claude-opus-5',
        max_tokens: 1024,
        system: MODERATION_SYSTEM_PROMPT,
        tools,
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      this.logger.error(
        `Moderation call failed for listing=${listingId} (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}`,
      );
      this.prometheusService.incrementAiModerationJobProcessed('error');
      // Rethrow so Bull schedules the next retry per MODERATION_JOB_OPTIONS.
      throw err;
    }

    this.logger.log(
      `Moderation call for listing=${listingId} used ` +
        `${response.usage.input_tokens}+${response.usage.output_tokens} tokens.`,
    );

    const toolUseBlock = response.content.find(
      (block): block is Extract<typeof block, { type: 'tool_use' }> =>
        block.type === 'tool_use' && block.name === 'flag_content',
    );

    if (!toolUseBlock) {
      this.logger.log(
        `Listing ${listingId}: moderation agent found no policy violation.`,
      );
      this.prometheusService.incrementAiModerationJobProcessed('clean');
      return;
    }

    if (!isUUID(listingId)) {
      // Happens for a listing created via the on-chain-settlement path
      // (ENABLE_ONCHAIN_SETTLEMENT), which doesn't persist a `listings`
      // row and so has no UUID id — flag_content's schema requires one,
      // and there is no DB row to attribute a flag to.
      this.logger.warn(
        `Listing ${listingId} was flagged by the moderation agent, but its id is not a ` +
          `UUID (likely a non-persisted, on-chain-only listing) — the flag cannot be ` +
          'recorded against it. Skipping.',
      );
      this.prometheusService.incrementAiModerationJobProcessed('skipped');
      return;
    }

    try {
      const parsedInput: unknown = flagContentTool.parse(toolUseBlock.input);
      await flagContentTool.run(parsedInput);
      this.logger.log(`Listing ${listingId} flagged for moderation review.`);
      this.prometheusService.incrementAiModerationJobProcessed('flagged');
    } catch (err) {
      this.logger.error(
        `Failed to persist moderation flag for listing=${listingId} (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}`,
      );
      this.prometheusService.incrementAiModerationJobProcessed('error');
      throw err;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<AiModerationJobData>, err: Error): void {
    this.logger.error(
      `Moderation job permanently failed for listing=${job.data.listingId}: ${err.message}`,
    );
  }
}
