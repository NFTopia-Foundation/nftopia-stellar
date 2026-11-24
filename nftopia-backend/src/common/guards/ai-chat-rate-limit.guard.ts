import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { TOOL_SET_KEY } from '../decorators/tool-set.decorator';
import type { ToolSetName } from '../../modules/ai-agent/tools/tool-set.types';
import type {
  RateLimitConsumeResult,
  RateLimiterClient,
} from './rate-limiter-client.interface';

export const AI_CHAT_RATE_LIMITERS = 'AI_CHAT_RATE_LIMITERS';

/** Tool set a route is treated as when it carries no `@ToolSet(...)` decorator. */
export const DEFAULT_RATE_LIMITED_TOOL_SET: ToolSetName =
  'marketplace-assistant';

/** One independently-configured, independently-tracked limiter per AI tool set. */
export type AiChatRateLimiterMap = Partial<
  Record<ToolSetName, RateLimiterClient>
>;

/** Injection token for the per-user rate-limit override lookup (#751). */
export const AI_CHAT_RATE_LIMIT_OVERRIDES = 'AI_CHAT_RATE_LIMIT_OVERRIDES';

/** Injection token for the factory that builds limiters with a custom budget (#751). */
export const AI_CHAT_RATE_LIMITER_FACTORY = 'AI_CHAT_RATE_LIMITER_FACTORY';

/**
 * Resolves an admin-set per-user chat rate budget (#751). Implemented by
 * AiUsageService on top of UserAiCapOverride; expected to cache briefly,
 * since it is consulted on every chat request.
 */
export interface AiChatRateLimitOverrideLookup {
  getRateLimitPointsOverride(
    userId: string,
    toolSet: ToolSetName,
  ): Promise<number | null>;
}

/**
 * Returns a limiter for `toolSet` whose budget is `points` per window.
 * rate-limiter-flexible fixes `points` per limiter instance, so a user with
 * an overridden budget needs a limiter (and Redis key prefix) of their own
 * budget's size. Implementations should memoize per (toolSet, points).
 */
export type AiChatRateLimiterFactory = (
  toolSet: ToolSetName,
  points: number,
) => RateLimiterClient;

type RequestWithUser = Request & { user?: { userId?: string } };

/**
 * Per-user, per-tool-set rate limiter for AI chat-shaped endpoints (#645).
 *
 * Each request can trigger several Anthropic API calls inside
 * AiAgentService's tool-calling loop, so this is deliberately keyed by the
 * authenticated user id rather than IP. It used to be a single global
 * bucket shared by every tool set a chat-shaped route might target; it now
 * reads the route's `@ToolSet(...)` metadata (defaulting to
 * 'marketplace-assistant' when absent — every route using this guard today)
 * and dispatches to that tool set's own RateLimiterRedis instance, so
 * exhausting one tool set's budget never blocks a different one for the
 * same user. Write-capable tool sets (e.g. 'creator-copilot') are
 * configured with a stricter points budget than the read-only
 * 'marketplace-assistant' — see AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT
 * in ai-chat-rate-limiter.provider.ts.
 *
 * (`/ai/copilot/draft-listing` has its own separate, pre-existing
 * CopilotRateLimitGuard/bucket — see that guard's doc comment for why. This
 * guard's tool-set awareness is about chat-shaped routes that may someday
 * target more than the one hardcoded tool set they do today.)
 *
 * Per-user overrides (#751): an admin can set a user's budget per tool set
 * through the existing POST /ai/admin/usage/:userId/override endpoint
 * (stored on UserAiCapOverride.rateLimitPoints). When an override applies,
 * the request is consumed against a limiter sized to that budget and the
 * effective budget is reported in X-RateLimit-Limit; otherwise the env
 * default applies. If the override lookup itself fails, the guard logs and
 * falls back to the default rather than failing the chat request.
 *
 * Must run after JwtAuthGuard so req.user.userId is populated. Falls back
 * to IP keying only if a user id is unexpectedly missing (anonymous keys
 * never get overrides).
 */
@Injectable()
export class AiChatRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AiChatRateLimitGuard.name);
  private readonly pointsByToolSet: Partial<Record<ToolSetName, number>>;

  constructor(
    @Inject(AI_CHAT_RATE_LIMITERS)
    private readonly limiters: AiChatRateLimiterMap,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    @Optional()
    @Inject(AI_CHAT_RATE_LIMIT_OVERRIDES)
    private readonly overrides?: AiChatRateLimitOverrideLookup,
    @Optional()
    @Inject(AI_CHAT_RATE_LIMITER_FACTORY)
    private readonly limiterFactory?: AiChatRateLimiterFactory,
  ) {
    this.pointsByToolSet = {
      'marketplace-assistant': Number(
        this.config.get('AI_CHAT_RATE_LIMIT_POINTS') ?? 20,
      ),
      'creator-copilot': Number(
        this.config.get('AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT') ?? 5,
      ),
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const res = context.switchToHttp().getResponse<Response>();

    const toolSet = this.resolveToolSet(context);
    const key = this.resolveKey(req);
    const { limiter, points } = await this.resolveBudget(
      toolSet,
      req.user?.userId,
    );

    try {
      const result = await limiter.consume(key, 1);
      res.setHeader('X-RateLimit-Limit', String(points));
      res.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, result.remainingPoints ?? 0)),
      );
      return true;
    } catch (error: unknown) {
      const rejRes = error as RateLimitConsumeResult;
      const retrySecs = Math.ceil((rejRes.msBeforeNext ?? 0) / 1000) || 1;
      res.setHeader('Retry-After', String(retrySecs));
      res.setHeader('X-RateLimit-Limit', String(points));
      res.setHeader('X-RateLimit-Remaining', '0');
      throw new HttpException(
        'Too many AI chat requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private resolveToolSet(context: ExecutionContext): ToolSetName {
    return (
      this.reflector.getAllAndOverride<ToolSetName | undefined>(TOOL_SET_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMITED_TOOL_SET
    );
  }

  /**
   * The limiter and budget in effect for this user and tool set: the
   * admin-set override when one exists and differs from the default (and a
   * limiter factory is available to honour it), otherwise the env default.
   */
  private async resolveBudget(
    toolSet: ToolSetName,
    userId: string | undefined,
  ): Promise<{ limiter: RateLimiterClient; points: number }> {
    const defaultPoints = this.pointsFor(toolSet);
    const defaultBudget = {
      limiter: this.limiterFor(toolSet),
      points: defaultPoints,
    };

    if (!userId || !this.overrides || !this.limiterFactory) {
      return defaultBudget;
    }

    let overridePoints: number | null;
    try {
      overridePoints = await this.overrides.getRateLimitPointsOverride(
        userId,
        toolSet,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Rate-limit override lookup failed for user ${userId}; using default budget: ${(error as Error)?.message ?? String(error)}`,
      );
      return defaultBudget;
    }

    if (
      overridePoints == null ||
      !Number.isInteger(overridePoints) ||
      overridePoints <= 0 ||
      overridePoints === defaultPoints
    ) {
      return defaultBudget;
    }

    return {
      limiter: this.limiterFactory(toolSet, overridePoints),
      points: overridePoints,
    };
  }

  private limiterFor(toolSet: ToolSetName): RateLimiterClient {
    const limiter =
      this.limiters[toolSet] ?? this.limiters[DEFAULT_RATE_LIMITED_TOOL_SET];
    if (!limiter) {
      throw new Error(
        `No rate limiter configured for AI tool set "${toolSet}" (and no default limiter to fall back to)`,
      );
    }
    return limiter;
  }

  private pointsFor(toolSet: ToolSetName): number {
    return (
      this.pointsByToolSet[toolSet] ??
      this.pointsByToolSet[DEFAULT_RATE_LIMITED_TOOL_SET]!
    );
  }

  private resolveKey(req: RequestWithUser): string {
    const userId = req.user?.userId;
    if (userId) {
      return `user:${userId}`;
    }

    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.connection?.remoteAddress ||
      'unknown';
    return `ip:${String(ip).split(',')[0].trim()}`;
  }
}
