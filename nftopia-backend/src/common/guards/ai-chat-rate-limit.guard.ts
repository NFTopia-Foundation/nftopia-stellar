import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
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
 * Must run after JwtAuthGuard so req.user.userId is populated. Falls back
 * to IP keying only if a user id is unexpectedly missing.
 */
@Injectable()
export class AiChatRateLimitGuard implements CanActivate {
  private readonly pointsByToolSet: Partial<Record<ToolSetName, number>>;

  constructor(
    @Inject(AI_CHAT_RATE_LIMITERS)
    private readonly limiters: AiChatRateLimiterMap,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
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
    const limiter = this.limiterFor(toolSet);
    const points = this.pointsFor(toolSet);
    const key = this.resolveKey(req);

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
