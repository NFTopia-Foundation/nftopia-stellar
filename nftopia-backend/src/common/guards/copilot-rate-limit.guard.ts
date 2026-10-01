import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type {
  RateLimitConsumeResult,
  RateLimiterClient,
} from './rate-limiter-client.interface';

export const COPILOT_RATE_LIMITER = 'COPILOT_RATE_LIMITER';

type RequestWithUser = Request & { user?: { userId?: string } };

/**
 * Per-user rate limiter for POST /ai/copilot/draft-listing (#528).
 * Deliberately separate from AiChatRateLimitGuard: drafting a listing is a
 * write-capable, more deliberate action than a chat turn (one forced
 * tool-call completion per request, not an open-ended multi-turn/
 * multi-tool loop), so it gets its own — tighter — budget rather than
 * sharing the chat limiter's bucket. A user who has exhausted their chat
 * limit for the hour can still draft a listing, and vice versa.
 *
 * Configured independently via AI_COPILOT_RATE_LIMIT_POINTS /
 * AI_COPILOT_RATE_LIMIT_TTL. Must run after JwtAuthGuard so req.user.userId
 * is populated; falls back to IP keying only if a user id is unexpectedly
 * missing.
 */
@Injectable()
export class CopilotRateLimitGuard implements CanActivate {
  private readonly points: number;

  constructor(
    @Inject(COPILOT_RATE_LIMITER)
    private readonly limiter: RateLimiterClient,
    private readonly config: ConfigService,
  ) {
    this.points = Number(this.config.get('AI_COPILOT_RATE_LIMIT_POINTS') ?? 5);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const res = context.switchToHttp().getResponse<Response>();

    const key = this.resolveKey(req);

    try {
      const result = await this.limiter.consume(key, 1);
      res.setHeader('X-RateLimit-Limit', String(this.points));
      res.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, result.remainingPoints ?? 0)),
      );
      return true;
    } catch (error: unknown) {
      const rejRes = error as RateLimitConsumeResult;
      const retrySecs = Math.ceil((rejRes.msBeforeNext ?? 0) / 1000) || 1;
      res.setHeader('Retry-After', String(retrySecs));
      res.setHeader('X-RateLimit-Limit', String(this.points));
      res.setHeader('X-RateLimit-Remaining', '0');
      throw new HttpException(
        'Too many listing-draft requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
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
