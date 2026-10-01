import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { COPILOT_RATE_LIMITER } from './copilot-rate-limit.guard';

/**
 * Builds the Redis-backed RateLimiterClient used by CopilotRateLimitGuard.
 * Kept as a separate factory provider (rather than constructed inline in
 * the guard) so the guard itself can be unit tested with a fake limiter —
 * same reasoning as aiChatRateLimiterProvider, which this otherwise
 * mirrors with its own key prefix and defaults.
 */
export const copilotRateLimiterProvider: Provider = {
  provide: COPILOT_RATE_LIMITER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const points = Number(config.get('AI_COPILOT_RATE_LIMIT_POINTS') ?? 5);
    const duration = Number(config.get('AI_COPILOT_RATE_LIMIT_TTL') ?? 3600);

    const client = new Redis({
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(config.get('REDIS_PORT') ?? 6379),
      password: config.get<string>('REDIS_PASSWORD') ?? undefined,
    });

    return new RateLimiterRedis({
      storeClient: client,
      points,
      duration,
      keyPrefix: 'copilot-rl',
    });
  },
};
