import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  AI_MODERATION_QUEUE_NAME,
  MODERATE_LISTING_JOB,
} from './ai-moderation.types';
import type { ListingCreatedEvent } from './ai-moderation.types';

/**
 * Bounded retry/backoff for transient moderation failures (Anthropic API
 * errors, timeouts) — see AiModerationProcessor (#527), which is what
 * actually throws to trigger a retry. 3 attempts rather than e.g. email's
 * 5: each attempt costs a real Anthropic API call, so retrying more
 * aggressively just multiplies spend on a call that's likely to keep
 * failing for the same reason. removeOnFail is kept (not cleared) so an
 * exhausted job stays inspectable, matching email.service.ts's convention.
 */
const MODERATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: true,
  removeOnFail: false,
};

/**
 * Reacts to `listing.created` by enqueuing a moderation job — deliberately
 * doesn't call the AI agent inline, so a slow or unavailable moderation
 * agent never blocks the event handler. AiModerationProcessor (#527)
 * consumes this queue.
 */
@Injectable()
export class ListingCreatedListener {
  private readonly logger = new Logger(ListingCreatedListener.name);

  constructor(
    @InjectQueue(AI_MODERATION_QUEUE_NAME)
    private readonly moderationQueue: Queue,
  ) {}

  @OnEvent('listing.created')
  async handleListingCreated(event: ListingCreatedEvent): Promise<void> {
    try {
      await this.moderationQueue.add(
        MODERATE_LISTING_JOB,
        event,
        MODERATION_JOB_OPTIONS,
      );
    } catch (err) {
      // Swallow: a failed enqueue must never surface back to whoever
      // created the listing — it's already been persisted/settled.
      this.logger.error(
        `Failed to enqueue moderation job for listing=${event.listingId}: ${(err as Error).message}`,
      );
    }
  }
}
