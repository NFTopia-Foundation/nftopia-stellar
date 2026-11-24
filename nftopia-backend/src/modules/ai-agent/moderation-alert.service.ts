import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

const DEFAULT_DEBOUNCE_MS = 15 * 60 * 1000;

/**
 * Operator alert for ai-moderation jobs that exhausted every retry (#748).
 * Debounced per process: at most one email per window, with the number of
 * failures suppressed in between reported in the next email so a burst of
 * failures (e.g. an Anthropic outage) doesn't flood the inbox.
 */
@Injectable()
export class ModerationAlertService {
  private readonly logger = new Logger(ModerationAlertService.name);
  private lastSentAt = 0;
  private suppressed = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /** Never throws — an alert failure must not mask the job failure. */
  async alertExhausted(listingId: string, errorMessage: string): Promise<void> {
    try {
      const to = this.configService.get<string>('MODERATION_ALERT_EMAIL');
      if (!to) {
        return;
      }

      const debounceMs = this.resolveDebounceMs();
      const now = Date.now();
      if (this.lastSentAt !== 0 && now - this.lastSentAt < debounceMs) {
        this.suppressed += 1;
        return;
      }

      const suppressedCount = this.suppressed;
      this.lastSentAt = now;
      this.suppressed = 0;
      await this.emailService.sendModerationExhaustedAlertEmail(
        to,
        listingId,
        errorMessage,
        suppressedCount,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send moderation exhausted alert for listing=${listingId}: ${(err as Error).message}`,
      );
    }
  }

  private resolveDebounceMs(): number {
    const raw = Number(
      this.configService.get<string>('MODERATION_ALERT_DEBOUNCE_MS'),
    );
    return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DEBOUNCE_MS;
  }
}
