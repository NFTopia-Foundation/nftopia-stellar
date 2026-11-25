import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiUsageService } from './ai-usage.service';
import { PrometheusService } from '../../common/metrics/prometheus';
import { EmailService } from '../email/email.service';

const DEFAULT_DEBOUNCE_MS = 15 * 60 * 1000;

@Injectable()
export class AiPlatformSpendService {
  private readonly logger = new Logger(AiPlatformSpendService.name);
  private readonly dailyThreshold: number | null;
  private readonly monthlyThreshold: number | null;
  private readonly lastAlertAt = new Map<string, number>();
  private readonly exceeded = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly usage: AiUsageService,
    private readonly prometheus: PrometheusService,
    private readonly email: EmailService,
  ) {
    this.dailyThreshold = this.positiveNumber(config.get('AI_PLATFORM_DAILY_SPEND_ALERT_USD'));
    this.monthlyThreshold = this.positiveNumber(config.get('AI_PLATFORM_MONTHLY_SPEND_ALERT_USD'));
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSpend(): Promise<void> {
    await Promise.all([
      this.checkWindow('daily', this.startOfDay(), this.dailyThreshold),
      this.checkWindow('monthly', this.startOfMonth(), this.monthlyThreshold),
    ]);
  }

  private async checkWindow(window: 'daily' | 'monthly', since: Date, threshold: number | null): Promise<void> {
    const rows = await this.usage.getPlatformSpend(since);
    const total = rows.reduce((sum, row) => sum + row.estimatedCostUsd, 0);
    for (const row of rows) this.prometheus.setAiPlatformSpendUsd(window, row.toolSet, row.estimatedCostUsd);
    this.prometheus.setAiPlatformSpendUsd(window, 'all', total);
    if (threshold === null || total < threshold) {
      this.exceeded.delete(window);
      return;
    }
    const now = Date.now();
    const last = this.lastAlertAt.get(window) ?? 0;
    if (this.exceeded.has(window) && now - last < this.debounceMs()) return;
    this.exceeded.add(window);
    this.lastAlertAt.set(window, now);
    try {
      await this.email.sendAiPlatformSpendAlertEmail(
        this.config.get<string>('AI_PLATFORM_SPEND_ALERT_EMAIL'),
        window,
        threshold,
        total,
        rows,
      );
    } catch (error) {
      this.logger.error(`Failed to send AI platform spend alert: ${(error as Error).message}`);
    }
  }

  private positiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  private debounceMs(): number {
    const parsed = Number(this.config.get('AI_PLATFORM_SPEND_ALERT_DEBOUNCE_MS'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DEBOUNCE_MS;
  }
  private startOfDay(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  private startOfMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
