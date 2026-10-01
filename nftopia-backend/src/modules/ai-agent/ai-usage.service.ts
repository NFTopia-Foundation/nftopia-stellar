import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiUsageRecord } from './entities/ai-usage-record.entity';
import { UserAiCapOverride } from './entities/user-ai-cap-override.entity';
import { estimateCostUsd } from './ai-usage-pricing';

export interface UsageWindow {
  totalTokens: number;
  estimatedCostUsd: number;
  /** Token cap currently in effect for this window (override, if active and set — otherwise the env default). */
  cap: number;
  remaining: number;
  /** USD spend cap currently in effect, or null when no spend cap is configured for this window. */
  spendCapUsd: number | null;
  spendRemaining: number | null;
  /** 0-100. The higher of the token-cap and (if configured) spend-cap percentage. */
  percentUsed: number;
  /** True once percentUsed crosses AI_CHAT_CAP_WARNING_THRESHOLD but before the cap is actually reached. */
  approachingCap: boolean;
  /** ISO timestamp this window's usage resets at (start of next day / next month, UTC). */
  resetsAt: string;
}

export interface UsageSummary {
  daily: UsageWindow;
  monthly: UsageWindow;
  /** Whether an admin-granted cap override is currently active for this user. */
  hasOverride: boolean;
}

export interface SetCapOverrideParams {
  dailyTokenCap?: number | null;
  monthlyTokenCap?: number | null;
  dailySpendCapUsd?: number | null;
  monthlySpendCapUsd?: number | null;
  reason?: string;
  grantedBy?: string;
  expiresAt?: Date | null;
}

interface UsageAggregate {
  totalTokens: number;
  estimatedCostUsd: number;
}

interface EffectiveCaps {
  dailyTokenCap: number;
  monthlyTokenCap: number;
  dailySpendCapUsd: number | null;
  monthlySpendCapUsd: number | null;
}

const DAILY_CAP_REACHED = 'AI_DAILY_TOKEN_CAP_REACHED';
const MONTHLY_CAP_REACHED = 'AI_MONTHLY_TOKEN_CAP_REACHED';
const DAILY_SPEND_CAP_REACHED = 'AI_DAILY_SPEND_CAP_REACHED';
const MONTHLY_SPEND_CAP_REACHED = 'AI_MONTHLY_SPEND_CAP_REACHED';

/**
 * Tracks per-user AI token spend and enforces daily/monthly caps.
 * "Daily" and "monthly" are calendar windows in UTC (since midnight / since
 * the 1st of the month), not rolling windows.
 *
 * Enforcement point (#529): deliberately a plain method
 * (`assertWithinCap`) called from inside `AiAgentService.chat` and
 * `chatStream`, not a guard. A guard only sees the HTTP layer, and would
 * have to be duplicated (or shared awkwardly) across the POST /ai/chat and
 * SSE /ai/chat/stream routes; calling it once from the service method both
 * routes already funnel through guarantees the check can never be added to
 * one and forgotten on the other.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);
  private readonly dailyCap: number;
  private readonly monthlyCap: number;
  /** Optional — unset means spend (USD) is tracked for reporting only, and only the token caps are enforced. */
  private readonly dailySpendCapUsd: number | null;
  private readonly monthlySpendCapUsd: number | null;
  /** Fraction (0-1) of a cap at which `approachingCap` turns on. */
  private readonly warningThreshold: number;

  constructor(
    @InjectRepository(AiUsageRecord)
    private readonly usageRepo: Repository<AiUsageRecord>,
    @InjectRepository(UserAiCapOverride)
    private readonly overrideRepo: Repository<UserAiCapOverride>,
    private readonly config: ConfigService,
  ) {
    this.dailyCap = Number(
      this.config.get('AI_CHAT_DAILY_TOKEN_CAP') ?? 200_000,
    );
    this.monthlyCap = Number(
      this.config.get('AI_CHAT_MONTHLY_TOKEN_CAP') ?? 2_000_000,
    );
    this.dailySpendCapUsd = this.parseOptionalPositiveNumber(
      this.config.get('AI_CHAT_DAILY_SPEND_CAP_USD'),
    );
    this.monthlySpendCapUsd = this.parseOptionalPositiveNumber(
      this.config.get('AI_CHAT_MONTHLY_SPEND_CAP_USD'),
    );
    const configuredThreshold = Number(
      this.config.get('AI_CHAT_CAP_WARNING_THRESHOLD') ?? 0.8,
    );
    this.warningThreshold =
      Number.isFinite(configuredThreshold) &&
      configuredThreshold > 0 &&
      configuredThreshold < 1
        ? configuredThreshold
        : 0.8;
  }

  /**
   * Persists token usage for a completed /ai/chat call. Never throws —
   * failures are logged so a usage-recording problem can't fail an
   * otherwise-successful chat reply. Callers should not await this on the
   * response path.
   */
  async recordUsage(
    userId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    try {
      const totalTokens = inputTokens + outputTokens;
      const estimatedCostUsd = estimateCostUsd(
        model,
        inputTokens,
        outputTokens,
      );

      await this.usageRepo.save(
        this.usageRepo.create({
          userId,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCostUsd: estimatedCostUsd.toFixed(6),
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to record AI usage for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Throws ForbiddenException if the user's current-day or current-month
   * usage has already reached its cap (token count, and — when configured
   * — estimated USD spend). Call before invoking the Anthropic API.
   *
   * The thrown exception's response body carries a machine-readable `code`
   * and `resetsAt` (ISO timestamp), not just a prose message, so a client
   * can distinguish this from a generic 403 and tell the user precisely
   * when they can try again — this is deliberately still a
   * `ForbiddenException` (403), not the 429 `AiChatRateLimitGuard` uses,
   * since "you've spent your budget" and "you're calling too fast" are
   * different problems with different remedies.
   */
  async assertWithinCap(userId: string): Promise<void> {
    const caps = await this.getEffectiveCaps(userId);
    const [daily, monthly] = await Promise.all([
      this.aggregate(userId, this.startOfDay()),
      this.aggregate(userId, this.startOfMonth()),
    ]);

    if (daily.totalTokens >= caps.dailyTokenCap) {
      this.throwCapExceeded(
        DAILY_CAP_REACHED,
        `Daily AI usage cap reached (${caps.dailyTokenCap} tokens). Please try again tomorrow.`,
        this.startOfNextDay(),
      );
    }
    if (
      caps.dailySpendCapUsd !== null &&
      daily.estimatedCostUsd >= caps.dailySpendCapUsd
    ) {
      this.throwCapExceeded(
        DAILY_SPEND_CAP_REACHED,
        `Daily AI spend cap reached ($${caps.dailySpendCapUsd.toFixed(2)}). Please try again tomorrow.`,
        this.startOfNextDay(),
      );
    }
    if (monthly.totalTokens >= caps.monthlyTokenCap) {
      this.throwCapExceeded(
        MONTHLY_CAP_REACHED,
        `Monthly AI usage cap reached (${caps.monthlyTokenCap} tokens). Please try again next month.`,
        this.startOfNextMonth(),
      );
    }
    if (
      caps.monthlySpendCapUsd !== null &&
      monthly.estimatedCostUsd >= caps.monthlySpendCapUsd
    ) {
      this.throwCapExceeded(
        MONTHLY_SPEND_CAP_REACHED,
        `Monthly AI spend cap reached ($${caps.monthlySpendCapUsd.toFixed(2)}). Please try again next month.`,
        this.startOfNextMonth(),
      );
    }
  }

  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const [caps, daily, monthly] = await Promise.all([
      this.getEffectiveCaps(userId),
      this.aggregate(userId, this.startOfDay()),
      this.aggregate(userId, this.startOfMonth()),
    ]);

    return {
      daily: this.buildWindow(
        daily,
        caps.dailyTokenCap,
        caps.dailySpendCapUsd,
        this.startOfNextDay(),
      ),
      monthly: this.buildWindow(
        monthly,
        caps.monthlyTokenCap,
        caps.monthlySpendCapUsd,
        this.startOfNextMonth(),
      ),
      hasOverride: caps.hasOverride,
    };
  }

  // ── Admin override management ──────────────────────────────────────────

  /**
   * Sets (replacing any existing) cap override for a user. Any field left
   * undefined/null falls back to the env-configured default for that
   * specific cap — an override doesn't have to touch every cap at once
   * (e.g. raising only the daily token cap while leaving the monthly one
   * and both spend caps at their defaults).
   */
  async setCapOverride(
    userId: string,
    params: SetCapOverrideParams,
  ): Promise<UserAiCapOverride> {
    const existing = await this.overrideRepo.findOne({ where: { userId } });
    const entity = this.overrideRepo.create({
      ...existing,
      userId,
      dailyTokenCap: params.dailyTokenCap ?? null,
      monthlyTokenCap: params.monthlyTokenCap ?? null,
      dailySpendCapUsd:
        params.dailySpendCapUsd != null
          ? params.dailySpendCapUsd.toFixed(6)
          : null,
      monthlySpendCapUsd:
        params.monthlySpendCapUsd != null
          ? params.monthlySpendCapUsd.toFixed(6)
          : null,
      reason: params.reason ?? null,
      grantedBy: params.grantedBy ?? null,
      expiresAt: params.expiresAt ?? null,
    });

    const saved = await this.overrideRepo.save(entity);
    this.logger.log(
      `AI cap override set for user ${userId} by ${params.grantedBy ?? 'unknown'}: ${JSON.stringify(params)}`,
    );
    return saved;
  }

  /** Clears a user's override, reverting them to the env-configured default caps. */
  async clearCapOverride(userId: string): Promise<void> {
    await this.overrideRepo.delete({ userId });
    this.logger.log(`AI cap override cleared for user ${userId}`);
  }

  async getCapOverride(userId: string): Promise<UserAiCapOverride | null> {
    const override = await this.overrideRepo.findOne({ where: { userId } });
    return this.isActive(override) ? override : null;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private throwCapExceeded(
    code: string,
    message: string,
    resetsAt: Date,
  ): never {
    throw new ForbiddenException({
      statusCode: 403,
      code,
      message,
      resetsAt: resetsAt.toISOString(),
    });
  }

  private async getEffectiveCaps(
    userId: string,
  ): Promise<EffectiveCaps & { hasOverride: boolean }> {
    const override = await this.getCapOverride(userId);

    return {
      dailyTokenCap: override?.dailyTokenCap ?? this.dailyCap,
      monthlyTokenCap: override?.monthlyTokenCap ?? this.monthlyCap,
      dailySpendCapUsd:
        override?.dailySpendCapUsd != null
          ? Number(override.dailySpendCapUsd)
          : this.dailySpendCapUsd,
      monthlySpendCapUsd:
        override?.monthlySpendCapUsd != null
          ? Number(override.monthlySpendCapUsd)
          : this.monthlySpendCapUsd,
      hasOverride: override !== null,
    };
  }

  private isActive(override: UserAiCapOverride | null): boolean {
    if (!override) return false;
    if (!override.expiresAt) return true;
    return new Date(override.expiresAt).getTime() > Date.now();
  }

  private buildWindow(
    agg: UsageAggregate,
    tokenCap: number,
    spendCapUsd: number | null,
    resetsAt: Date,
  ): UsageWindow {
    const tokenPercent = tokenCap > 0 ? agg.totalTokens / tokenCap : 0;
    const spendPercent =
      spendCapUsd !== null && spendCapUsd > 0
        ? agg.estimatedCostUsd / spendCapUsd
        : 0;
    const fractionUsed = Math.max(tokenPercent, spendPercent);
    const percentUsed = Math.min(100, Math.round(fractionUsed * 100));

    return {
      totalTokens: agg.totalTokens,
      estimatedCostUsd: agg.estimatedCostUsd,
      cap: tokenCap,
      remaining: this.remaining(agg.totalTokens, tokenCap),
      spendCapUsd,
      spendRemaining:
        spendCapUsd !== null
          ? Math.max(0, spendCapUsd - agg.estimatedCostUsd)
          : null,
      percentUsed,
      approachingCap: fractionUsed >= this.warningThreshold && fractionUsed < 1,
      resetsAt: resetsAt.toISOString(),
    };
  }

  private remaining(used: number, cap: number): number {
    return Math.max(0, cap - used);
  }

  private parseOptionalPositiveNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private async aggregate(
    userId: string,
    since: Date,
  ): Promise<UsageAggregate> {
    const result = await this.usageRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.totalTokens), 0)', 'totalTokens')
      .addSelect('COALESCE(SUM(r.estimatedCostUsd), 0)', 'estimatedCostUsd')
      .where('r.userId = :userId', { userId })
      .andWhere('r.createdAt >= :since', { since })
      .getRawOne<{ totalTokens: string; estimatedCostUsd: string }>();

    return {
      totalTokens: Number(result?.totalTokens ?? 0),
      estimatedCostUsd: Number(result?.estimatedCostUsd ?? 0),
    };
  }

  private startOfDay(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private startOfNextDay(): Date {
    const start = this.startOfDay();
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }

  private startOfMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private startOfNextMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }
}
