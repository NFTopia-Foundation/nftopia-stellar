import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';

@Injectable()
export class RedisRateGuard implements CanActivate {
  private readonly limiter: RateLimiterRedis;
  private readonly points: number;
  private readonly duration: number;

  constructor(private readonly config: ConfigService) {
    const cfgPoints = this.config.get<number>('RATE_LIMIT');
    this.points = Number(cfgPoints ?? 100);

    const cfgDuration = this.config.get<number>('RATE_LIMIT_TTL');
    this.duration = Number(cfgDuration ?? 60);

    const redisHost = this.config.get<string>('REDIS_HOST') ?? 'localhost';
    const redisPort = Number(this.config.get<number>('REDIS_PORT') ?? 6379);
    const redisPassword =
      this.config.get<string>('REDIS_PASSWORD') ?? undefined;

    const client = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    });

    this.limiter = new RateLimiterRedis({
      storeClient: client,
      points: this.points,
      duration: this.duration,
      keyPrefix: 'rlflx',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.connection?.remoteAddress ||
      'unknown';
    const key = String(ip).split(',')[0].trim();

    try {
      const rlRes = await this.limiter.consume(key, 1);
      res.setHeader('X-RateLimit-Limit', String(this.points));
      res.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, rlRes.remainingPoints ?? 0)),
      );
      return true;
    } catch (error: unknown) {
      const rejRes = error as RateLimiterRes;
      const retrySecs = Math.ceil((rejRes.msBeforeNext ?? 0) / 1000) || 1;
      res.setHeader('Retry-After', String(retrySecs));
      res.setHeader('X-RateLimit-Limit', String(this.points));
      res.setHeader('X-RateLimit-Remaining', '0');
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
