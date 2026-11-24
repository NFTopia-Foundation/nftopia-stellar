import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import {
  AI_CHAT_RATE_LIMITER_FACTORY,
  AI_CHAT_RATE_LIMITERS,
  type AiChatRateLimiterFactory,
  type AiChatRateLimiterMap,
} from './ai-chat-rate-limit.guard';
import type { RateLimiterClient } from './rate-limiter-client.interface';

/** Injection token for the Redis connection shared by every AI chat limiter. */
export const AI_CHAT_RATE_LIMIT_REDIS = 'AI_CHAT_RATE_LIMIT_REDIS';

const KEY_PREFIX = 'ai-chat-rl';

const durationFrom = (config: ConfigService): number =>
  Number(config.get('AI_CHAT_RATE_LIMIT_TTL') ?? 600);

/**
 * One shared Redis connection: RateLimiterRedis instances stay independent
 * via their own keyPrefix, so there's no need for a separate connection per
 * tool set (or per overridden budget).
 */
export const aiChatRateLimitRedisProvider: Provider = {
  provide: AI_CHAT_RATE_LIMIT_REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis =>
    new Redis({
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(config.get('REDIS_PORT') ?? 6379),
      password: config.get<string>('REDIS_PASSWORD') ?? undefined,
    }),
};

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
  inject: [ConfigService, AI_CHAT_RATE_LIMIT_REDIS],
  useFactory: (
    config: ConfigService,
    storeClient: Redis,
  ): AiChatRateLimiterMap => {
    const duration = durationFrom(config);

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
        keyPrefix: `${KEY_PREFIX}:marketplace-assistant`,
      }),
      'creator-copilot': new RateLimiterRedis({
        storeClient,
        points: creatorCopilotPoints,
        duration,
        keyPrefix: `${KEY_PREFIX}:creator-copilot`,
      }),
    };
  },
};

/**
 * Builds limiters for admin-overridden per-user budgets (#751). Because
 * rate-limiter-flexible fixes `points` per instance, each distinct
 * (tool set, budget) pair gets its own memoized RateLimiterRedis with a
 * budget-specific key prefix. Consequence worth knowing: changing a user's
 * override (or clearing it) starts them in a fresh bucket rather than
 * carrying over what they consumed under the previous budget.
 */
export const aiChatRateLimiterFactoryProvider: Provider = {
  provide: AI_CHAT_RATE_LIMITER_FACTORY,
  inject: [ConfigService, AI_CHAT_RATE_LIMIT_REDIS],
  useFactory: (
    config: ConfigService,
    storeClient: Redis,
  ): AiChatRateLimiterFactory =>
    createMemoizedLimiterFactory(
      (toolSet, points) =>
        new RateLimiterRedis({
          storeClient,
          points,
          duration: durationFrom(config),
          keyPrefix: `${KEY_PREFIX}:${toolSet}:override-${points}`,
        }),
    ),
};

/** Wraps a limiter constructor so each (toolSet, points) pair is built once. */
export function createMemoizedLimiterFactory(
  build: AiChatRateLimiterFactory,
): AiChatRateLimiterFactory {
  const cache = new Map<string, RateLimiterClient>();
  return (toolSet, points) => {
    const cacheKey = `${toolSet}:${points}`;
    let limiter = cache.get(cacheKey);
    if (!limiter) {
      limiter = build(toolSet, points);
      cache.set(cacheKey, limiter);
    }
    return limiter;
  };
}

/** Every provider AiChatRateLimitGuard's limiters need, for a module's `providers`. */
export const aiChatRateLimiterProviders: Provider[] = [
  aiChatRateLimitRedisProvider,
  aiChatRateLimiterProvider,
  aiChatRateLimiterFactoryProvider,
];
