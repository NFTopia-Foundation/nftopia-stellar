import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessage,
  BetaMessageParam,
} from '@anthropic-ai/sdk/resources/beta/messages';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NftService } from '../nft/nft.service';
import { ListingService } from '../listing/listing.service';
import { CollectionService } from '../collection/collection.service';
import { OrderService } from '../order/order.service';
import { AuctionService } from '../auction/auction.service';
import { resolveToolSet } from './tools/tool-set.registry';
import type { ToolSetName } from './tools/tool-set.types';
import type { DraftListingResult } from './tools/creator-copilot.tools';
import { AiUsageService } from './ai-usage.service';
import { ChatSessionService } from './chat-session.service';
import { AiToolCallLog } from './entities/ai-tool-call-log.entity';
import { PromptInjectionService } from './prompt-injection.service';

const SYSTEM_PROMPT = `You are the NFTopia marketplace assistant. You help users find NFTs, \
listings, and collections on the NFTopia Stellar marketplace, answer questions about the \
status of their own past orders (purchases and sales), and answer questions about auctions \
and bids, using the tools available to you. get_auction alone does not include bid history — \
always call get_auction_bids when a question depends on actual bid activity (e.g. the current \
highest bid or whether anyone has bid), rather than assuming it. Only state facts returned by \
your tools — never invent prices, ownership, availability, order status, or bid amounts. If a \
search returns no results, say so plainly instead of guessing. Keep answers concise.`;

const CREATOR_COPILOT_SYSTEM_PROMPT = `You are the NFTopia creator co-pilot. Given an NFT's \
metadata (and, when available, its collection's floor price), draft a marketplace listing for \
it: a concise, compelling title, a short description, and a suggested price with your \
reasoning. Ground the price in the data given — the collection floor price or the NFT's own \
last sale price when present — rather than inventing a number. You MUST call draft_listing \
exactly once with your suggestion; do not reply with plain text. This is a draft only: the \
creator will review and can edit anything before it is ever published.`;

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);
  private readonly client = new Anthropic();

  constructor(
    private readonly nftService: NftService,
    private readonly listingService: ListingService,
    private readonly collectionService: CollectionService,
    private readonly orderService: OrderService,
    private readonly auctionService: AuctionService,
    private readonly aiUsageService: AiUsageService,
    private readonly chatSessionService: ChatSessionService,
    @InjectRepository(AiToolCallLog)
    private readonly toolCallLogRepo: Repository<AiToolCallLog>,
    private readonly promptInjectionService: PromptInjectionService,
  ) {}

  private getToolLogger(userId: string, sessionId: string) {
    return (
      toolName: string,
      args: Record<string, unknown>,
      resultSummary: string,
      durationMs: number,
    ) => {
      const redactedArgs = { ...args };
      // Redaction policy: Redact free-text user inputs which might contain PII or abuse
      const sensitiveFields = ['search', 'reason', 'message', 'content'];
      for (const field of sensitiveFields) {
        if (typeof redactedArgs[field] === 'string') {
          redactedArgs[field] = '[REDACTED]';
        }
      }

      this.toolCallLogRepo
        .save({
          userId,
          sessionId,
          toolName,
          args: redactedArgs,
          resultSummary,
          durationMs,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to save tool call log: ${(err as Error).message}`,
          );
        });
    };
  }

  async chat(
    userId: string,
    toolSet: ToolSetName,
    message: string,
    sessionId?: string,
  ): Promise<{ reply: string; sessionId: string }> {
    await this.aiUsageService.assertWithinCap(userId);

    // Screen the message for prompt-injection / jailbreak attempts before
    // touching the session or forwarding anything to the model.  We use a
    // placeholder session id in the log if no session exists yet, because
    // the real id is only known after loadOrCreateSession.
    const screening = this.promptInjectionService.screen(message);
    if (screening.flagged) {
      this.promptInjectionService.logFlagged(
        userId,
        sessionId ?? 'pre-session',
        screening.category!,
        message,
      );
      throw new BadRequestException(screening.reason);
    }

    // History always comes from the database — never from client input —
    // and ownership of an existing session is enforced here too (#487).
    const { session, history } =
      await this.chatSessionService.loadOrCreateSession(userId, sessionId);

    const tools = resolveToolSet(toolSet, {
      nftService: this.nftService,
      listingService: this.listingService,
      collectionService: this.collectionService,
      orderService: this.orderService,
      auctionService: this.auctionService,
      userId,
      toolLogger: this.getToolLogger(userId, session.id),
    });

    const messages: BetaMessageParam[] = [
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: message },
    ];

    try {
      const finalMessage = await this.client.beta.messages.toolRunner({
        model: 'claude-opus-5',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      // Fire-and-forget: recordUsage never throws, and the reply must not
      // wait on the write. finalMessage.usage reflects the final turn of
      // the tool-calling loop (the Anthropic SDK does not expose a
      // pre-summed cross-iteration total on the tool runner's result).
      void this.aiUsageService.recordUsage(
        userId,
        finalMessage.model,
        finalMessage.usage.input_tokens,
        finalMessage.usage.output_tokens,
      );

      const textBlocks = finalMessage.content.filter(
        (block): block is Extract<typeof block, { type: 'text' }> =>
          block.type === 'text',
      );
      const reply = textBlocks
        .map((block) => block.text)
        .join('\n')
        .trim();

      await this.chatSessionService.appendExchange(session.id, message, reply);

      return { reply, sessionId: session.id };
    } catch (error) {
      throw this.mapAnthropicError(error);
    }
  }

  /**
   * Streaming variant of chat(). Emits `text` deltas as they're generated,
   * a `tool_call` event whenever the model starts a tool_use block, and a
   * terminal `done` event with the full assembled reply. A mid-stream
   * `pause_turn` (long-running server-tool turns) is resumed transparently
   * by pushing the paused assistant turn back into the runner, per the
   * Anthropic SDK's documented streaming pause/resume pattern — the caller
   * never sees a truncated answer.
   *
   * Errors are delivered via the Observable's error channel. NestJS's SSE
   * response controller emits a terminal `error` SSE event for them once
   * streaming has started, or a normal HTTP error response if none of the
   * stream has been written yet (e.g. a cap-exceeded rejection).
   */
  chatStream(
    userId: string,
    toolSet: ToolSetName,
    message: string,
    sessionId?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let unsubscribed = false;

      void (async () => {
        try {
          await this.aiUsageService.assertWithinCap(userId);

          // Screen for injection/jailbreak before opening the session or
          // the streaming connection to the model.
          const screening = this.promptInjectionService.screen(message);
          if (screening.flagged) {
            this.promptInjectionService.logFlagged(
              userId,
              sessionId ?? 'pre-session',
              screening.category!,
              message,
            );
            throw new BadRequestException(screening.reason);
          }

          const { session, history } =
            await this.chatSessionService.loadOrCreateSession(
              userId,
              sessionId,
            );

          const tools = resolveToolSet(toolSet, {
            nftService: this.nftService,
            listingService: this.listingService,
            collectionService: this.collectionService,
            orderService: this.orderService,
            auctionService: this.auctionService,
            userId,
            toolLogger: this.getToolLogger(userId, session.id),
          });

          const messages: BetaMessageParam[] = [
            ...history.map((turn) => ({
              role: turn.role,
              content: turn.content,
            })),
            { role: 'user', content: message },
          ];

          const runner = this.client.beta.messages.toolRunner({
            model: 'claude-opus-5',
            max_tokens: 64000,
            thinking: { type: 'adaptive' },
            output_config: { effort: 'medium' },
            system: SYSTEM_PROMPT,
            tools,
            messages,
            stream: true,
          });

          const replyParts: string[] = [];
          let lastMessage: BetaMessage | null = null;

          for await (const stream of runner) {
            if (unsubscribed) return;

            for await (const event of stream) {
              if (unsubscribed) return;

              if (
                event.type === 'content_block_start' &&
                event.content_block.type === 'tool_use'
              ) {
                subscriber.next({
                  type: 'tool_call',
                  data: {
                    id: event.content_block.id,
                    name: event.content_block.name,
                  },
                });
              } else if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                replyParts.push(event.delta.text);
                subscriber.next({
                  type: 'text',
                  data: { text: event.delta.text },
                });
              }
            }

            lastMessage = await stream.finalMessage();
            if (lastMessage.stop_reason === 'pause_turn') {
              runner.pushMessages({
                role: 'assistant',
                content: lastMessage.content,
              });
            }
          }

          const finalMessage = lastMessage ?? (await runner.done());

          // Fire-and-forget, same contract as chat(): never blocks the
          // stream and never throws (see AiUsageService.recordUsage).
          void this.aiUsageService.recordUsage(
            userId,
            finalMessage.model,
            finalMessage.usage.input_tokens,
            finalMessage.usage.output_tokens,
          );

          const reply = replyParts.join('').trim();
          await this.chatSessionService.appendExchange(
            session.id,
            message,
            reply,
          );

          subscriber.next({
            type: 'done',
            data: { reply, sessionId: session.id },
          });
          subscriber.complete();
        } catch (error) {
          subscriber.error(this.mapAnthropicError(error));
        }
      })();

      return () => {
        unsubscribed = true;
      };
    });
  }

  /**
   * Drafts a marketplace listing (title/description/suggested price) for
   * an NFT the caller owns (#528). Ownership is checked here, *before* the
   * Anthropic API is ever called, so an unauthorized attempt costs nothing
   * and never reaches the model — the 'creator-copilot' tool set's
   * draft_listing tool then defensively re-checks the model's answer is
   * about the same NFT (see creator-copilot.tools.ts).
   *
   * Never persists a listing: the result is handed back for the creator to
   * review and edit. Publishing is a separate, explicit action via the
   * existing listing-creation endpoint.
   */
  async draftListing(
    userId: string,
    nftId: string,
  ): Promise<DraftListingResult> {
    await this.aiUsageService.assertWithinCap(userId);

    const nft = await this.nftService.findById(nftId);
    if (nft.ownerId !== userId) {
      throw new ForbiddenException(
        'You can only draft a listing for an NFT you own.',
      );
    }

    let floorPrice: string | undefined;
    if (nft.collectionId) {
      try {
        const stats = await this.collectionService.getStats(nft.collectionId);
        floorPrice = stats.floorPrice;
      } catch {
        // Best-effort context for the model — a stats lookup failure
        // should not block drafting, just leave the price ungrounded by
        // a floor price.
      }
    }

    const tools = resolveToolSet('creator-copilot', {
      expectedNftId: nftId,
      toolLogger: this.getToolLogger(userId, `copilot:${nftId}`),
    });
    const draftListingTool = tools.find((t) => t.name === 'draft_listing');
    if (!draftListingTool) {
      throw new InternalServerErrorException(
        'creator-copilot tool set is misconfigured',
      );
    }

    const nftContext = {
      id: nft.id,
      name: nft.name,
      description: nft.description ?? null,
      lastPrice: nft.lastPrice ?? null,
      collectionFloorPrice: floorPrice ?? null,
    };
    const prompt = `Draft a marketplace listing for this NFT:\n${JSON.stringify(nftContext, null, 2)}`;

    try {
      const response = await this.client.beta.messages.create({
        model: 'claude-opus-5',
        max_tokens: 2000,
        system: CREATOR_COPILOT_SYSTEM_PROMPT,
        tools,
        tool_choice: { type: 'tool', name: 'draft_listing' },
        messages: [{ role: 'user', content: prompt }],
      });

      void this.aiUsageService.recordUsage(
        userId,
        response.model,
        response.usage.input_tokens,
        response.usage.output_tokens,
      );

      const toolUseBlock = response.content.find(
        (block): block is Extract<typeof block, { type: 'tool_use' }> =>
          block.type === 'tool_use' && block.name === 'draft_listing',
      );
      if (!toolUseBlock) {
        throw new InternalServerErrorException(
          'AI assistant did not return a draft listing',
        );
      }

      const parsedInput: unknown = draftListingTool.parse(toolUseBlock.input);
      const resultJson = await draftListingTool.run(parsedInput);
      return JSON.parse(resultJson as string) as DraftListingResult;
    } catch (error) {
      throw this.mapAnthropicError(error);
    }
  }

  private mapAnthropicError(error: unknown): Error {
    if (error instanceof ForbiddenException) {
      // Cap-exceeded, already a clear typed/user-facing error — pass through.
      return error;
    }
    if (error instanceof Anthropic.RateLimitError) {
      this.logger.warn('Anthropic rate limit hit');
      return new ServiceUnavailableException(
        'AI assistant is busy, please try again shortly',
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      this.logger.error(
        'Anthropic authentication failed — check ANTHROPIC_API_KEY',
      );
      return new InternalServerErrorException('AI assistant is misconfigured');
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(`Anthropic API error: ${error.message}`);
      return new ServiceUnavailableException(
        'AI assistant is temporarily unavailable',
      );
    }
    this.logger.error('Unexpected error in AI assistant', error as Error);
    return new InternalServerErrorException('AI assistant failed to respond');
  }

  async getToolLogs(query: {
    userId?: string;
    sessionId?: string;
    toolName?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AiToolCallLog[]; total: number }> {
    const qb = this.toolCallLogRepo.createQueryBuilder('log');
    if (query.userId)
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    if (query.sessionId)
      qb.andWhere('log.sessionId = :sessionId', { sessionId: query.sessionId });
    if (query.toolName)
      qb.andWhere('log.toolName = :toolName', { toolName: query.toolName });

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
