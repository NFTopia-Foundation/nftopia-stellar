import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountDeletionService } from './account-deletion.service';

/**
 * Daily sweep that executes verified deletion requests once their 30-day
 * grace period has elapsed. Kept as a thin wrapper so the actual erasure
 * logic stays unit-testable in {@link AccountDeletionService}.
 */
@Injectable()
export class AccountDeletionScheduler {
  private readonly logger = new Logger(AccountDeletionScheduler.name);

  constructor(private readonly deletionService: AccountDeletionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDueDeletions(): Promise<void> {
    const completed = await this.deletionService.completeDueDeletions();
    if (completed > 0) {
      this.logger.log(`Completed ${completed} scheduled account deletion(s)`);
    }
  }
}
