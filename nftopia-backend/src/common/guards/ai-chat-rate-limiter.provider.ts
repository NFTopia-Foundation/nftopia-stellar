import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import {
  AI_CHAT_RATE_LIMITERS,
  type AiChatRateLimiterMap,
} from './ai-chat-rate-limit.guard';

/**
 * Builds the Redis-backed RateLimiterClient map AiChatRateLimitGuard uses
 * (#645) — one RateLimiterRedis instance per AI tool set, each with its own
 * points/duration and Redis key prefix, so a tool set's bucket is both
 * independently tracked (different keyPrefix) and independently budgeted
 * (its own `points`, which rate-limiter-flexible fixes per instance rather
 * than per key). Kept as a separate factory provider (rather than
 * constructed inline in the guard) so the guard itself can be unit tested
 * with fake limiters.
 */
export const aiChatRateLimiterProvider: Provider = {
  provide: AI_CHAT_RATE_LIMITERS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AiChatRateLimiterMap => {
    // One shared Redis connection: RateLimiterRedis instances stay
    // independent via their own keyPrefix, so there's no need for a
    // separate connection per tool set.
    const storeClient = new Redis({
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(config.get('REDIS_PORT') ?? 6379),
      password: config.get<string>('REDIS_PASSWORD') ?? undefined,
    });

    const duration = Number(config.get('AI_CHAT_RATE_LIMIT_TTL') ?? 600);

    const marketplaceAssistantPoints = Number(
      config.get('AI_CHAT_RATE_LIMIT_POINTS') ?? 20,
    );
    const creatorCopilotPoints = Number(
      config.get('AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT') ?? 5,
    );

    return {
      'marketplace-assistant': new RateLimiterRedis({
        storeClient,
        points: marketplaceAssistantPoints,
        duration,
        keyPrefix: 'ai-chat-rl:marketplace-assistant',
      }),
      'creator-copilot': new RateLimiterRedis({
        storeClient,
        points: creatorCopilotPoints,
        duration,
        keyPrefix: 'ai-chat-rl:creator-copilot',
      }),
    };
  },
};
