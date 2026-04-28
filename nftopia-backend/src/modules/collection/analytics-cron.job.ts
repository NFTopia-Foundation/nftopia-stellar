import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsCronJob {
  private readonly logger = new Logger(AnalyticsCronJob.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    this.logger.log(`Running analytics aggregation for ${date}`);
    await this.analyticsService.aggregateStatsForDate(date);
  }
}
