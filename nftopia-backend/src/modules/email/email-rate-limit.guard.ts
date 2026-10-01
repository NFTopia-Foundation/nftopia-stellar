import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';

/**
 * Stricter, email-specific rate limit for endpoints that trigger an
 * outbound transactional email (registration, password-reset requests).
 * Keyed by the target email address when present so an attacker can't
 * hammer a single victim's inbox from many IPs; falls back to IP otherwise.
 */
@Injectable()
export class EmailRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(EmailRateLimitGuard.name);
  private readonly limiter: RateLimiterRedis;
  private readonly points: number;
  private readonly duration: number;
  private readonly passwordResetLimiter: RateLimiterRedis;
  private readonly passwordResetPoints: number;
  private readonly passwordResetDuration: number;

  constructor(private readonly config: ConfigService) {
    this.points = Number(this.config.get('EMAIL_RATE_LIMIT_MAX') ?? 5);
    this.duration = Number(
      this.config.get('EMAIL_RATE_LIMIT_WINDOW_S') ?? 3600,
    );
    this.passwordResetPoints = Number(
      this.config.get('PASSWORD_RESET_RATE_LIMIT_MAX') ?? 3,
    );
    this.passwordResetDuration = Number(
      this.config.get('PASSWORD_RESET_RATE_LIMIT_WINDOW_S') ?? 3600,
    );

    const client = new Redis({
      host: this.config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(this.config.get('REDIS_PORT') ?? 6379),
      password: this.config.get<string>('REDIS_PASSWORD') ?? undefined,
    });

    this.limiter = new RateLimiterRedis({
      storeClient: client,
      points: this.points,
      duration: this.duration,
      keyPrefix: 'email-rl',
    });
    this.passwordResetLimiter = new RateLimiterRedis({
      storeClient: client,
      points: this.passwordResetPoints,
      duration: this.passwordResetDuration,
      keyPrefix: 'password-reset-rl',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const requestEmail = (req.body as { email?: unknown } | undefined)?.email;
    const email =
      typeof requestEmail === 'string'
        ? requestEmail.toLowerCase().trim()
        : undefined;
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.connection?.remoteAddress ||
      'unknown';
    const key = email
      ? `email:${email}`
      : `ip:${String(ip).split(',')[0].trim()}`;
    const isPasswordReset =
      req.path.endsWith('/password-reset/request') ||
      req.path.endsWith('/forgot-password');
    const limiter = isPasswordReset ? this.passwordResetLimiter : this.limiter;
    const points = isPasswordReset ? this.passwordResetPoints : this.points;

    try {
      const rlRes = await limiter.consume(key, 1);
      res.setHeader('X-Email-RateLimit-Limit', String(points));
      res.setHeader(
        'X-Email-RateLimit-Remaining',
        String(Math.max(0, rlRes.remainingPoints ?? 0)),
      );
      return true;
    } catch (error: unknown) {
      const rejRes = error as RateLimiterRes;
      const retrySecs = Math.ceil((rejRes.msBeforeNext ?? 0) / 1000) || 1;
      res.setHeader('Retry-After', String(retrySecs));
      res.setHeader('X-Email-RateLimit-Limit', String(points));
      res.setHeader('X-Email-RateLimit-Remaining', '0');
      if (isPasswordReset) {
        this.logger.warn(
          `Password reset audit: ${JSON.stringify({
            event: 'request',
            timestamp: new Date().toISOString(),
            userId: null,
            ipAddress: String(ip).split(',')[0].trim(),
            success: false,
            reason: 'rate_limited',
          })}`,
        );
      }
      throw new HttpException(
        'Too many email requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
