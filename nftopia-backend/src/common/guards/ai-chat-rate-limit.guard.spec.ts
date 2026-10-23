import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import {
  AiChatRateLimitGuard,
  type AiChatRateLimiterMap,
} from './ai-chat-rate-limit.guard';
import type { RateLimiterClient } from './rate-limiter-client.interface';
import type { ToolSetName } from '../../modules/ai-agent/tools/tool-set.types';

describe('AiChatRateLimitGuard', () => {
  let guard: AiChatRateLimitGuard;

  const marketplaceLimiter: jest.Mocked<RateLimiterClient> = {
    consume: jest.fn(),
  };
  const copilotLimiter: jest.Mocked<RateLimiterClient> = {
    consume: jest.fn(),
  };
  const limiters: AiChatRateLimiterMap = {
    'marketplace-assistant': marketplaceLimiter,
    'creator-copilot': copilotLimiter,
  };

  const config = {
    get: jest.fn(),
  };

  const reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>> = {
    getAllAndOverride: jest.fn(),
  };

  const makeContext = (
    overrides: {
      user?: { userId?: string };
      ip?: string;
      forwardedFor?: string;
      toolSet?: ToolSetName;
    } = {},
  ) => {
    const req = {
      user: overrides.user,
      ip: overrides.ip ?? '127.0.0.1',
      headers: overrides.forwardedFor
        ? { 'x-forwarded-for': overrides.forwardedFor }
        : {},
    };
    const res = { setHeader: jest.fn() };

    reflector.getAllAndOverride.mockReturnValue(overrides.toolSet);

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;

    return { context, req, res };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_CHAT_RATE_LIMIT_POINTS') return 20;
      if (key === 'AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT') return 5;
      return undefined;
    });

    guard = new AiChatRateLimitGuard(
      limiters,
      config as unknown as ConfigService,
      reflector as unknown as Reflector,
    );
  });

  it('allows an under-limit request and sets rate limit headers', async () => {
    marketplaceLimiter.consume.mockResolvedValue({
      remainingPoints: 19,
      msBeforeNext: 0,
    });
    const { context, res } = makeContext({ user: { userId: 'user-1' } });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '20');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '19');
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Retry-After',
      expect.anything(),
    );
  });

  it('rejects an over-limit request with 429 and sets Retry-After / remaining=0', async () => {
    marketplaceLimiter.consume.mockRejectedValue({
      remainingPoints: 0,
      msBeforeNext: 5000,
    });
    const { context, res } = makeContext({ user: { userId: 'user-1' } });

    let caught: unknown;
    try {
      await guard.canActivate(context);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '20');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('rounds up a sub-second Retry-After to at least 1 second', async () => {
    marketplaceLimiter.consume.mockRejectedValue({
      remainingPoints: 0,
      msBeforeNext: 200,
    });
    const { context, res } = makeContext({ user: { userId: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });

  it('keys the limiter by the authenticated user id, not the IP', async () => {
    marketplaceLimiter.consume.mockResolvedValue({
      remainingPoints: 19,
      msBeforeNext: 0,
    });
    const { context } = makeContext({
      user: { userId: 'user-42' },
      ip: '203.0.113.5',
    });

    await guard.canActivate(context);

    expect(marketplaceLimiter.consume).toHaveBeenCalledWith('user:user-42', 1);
    expect(marketplaceLimiter.consume).not.toHaveBeenCalledWith(
      expect.stringContaining('203.0.113.5'),
      expect.anything(),
    );
  });

  it('gives different users independent limiter keys', async () => {
    marketplaceLimiter.consume.mockResolvedValue({
      remainingPoints: 19,
      msBeforeNext: 0,
    });

    const { context: contextA } = makeContext({ user: { userId: 'user-a' } });
    const { context: contextB } = makeContext({ user: { userId: 'user-b' } });

    await guard.canActivate(contextA);
    await guard.canActivate(contextB);

    expect(marketplaceLimiter.consume).toHaveBeenNthCalledWith(
      1,
      'user:user-a',
      1,
    );
    expect(marketplaceLimiter.consume).toHaveBeenNthCalledWith(
      2,
      'user:user-b',
      1,
    );
  });

  it('falls back to IP keying when no authenticated user is present', async () => {
    marketplaceLimiter.consume.mockResolvedValue({
      remainingPoints: 19,
      msBeforeNext: 0,
    });
    const { context } = makeContext({ ip: '203.0.113.5' });

    await guard.canActivate(context);

    expect(marketplaceLimiter.consume).toHaveBeenCalledWith(
      'ip:203.0.113.5',
      1,
    );
  });

  it('prefers x-forwarded-for over req.ip in the IP fallback', async () => {
    marketplaceLimiter.consume.mockResolvedValue({
      remainingPoints: 19,
      msBeforeNext: 0,
    });
    const { context } = makeContext({
      ip: '127.0.0.1',
      forwardedFor: '198.51.100.9, 10.0.0.1',
    });

    await guard.canActivate(context);

    expect(marketplaceLimiter.consume).toHaveBeenCalledWith(
      'ip:198.51.100.9',
      1,
    );
  });

  it('reads the marketplace-assistant points threshold from AI_CHAT_RATE_LIMIT_POINTS', () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_CHAT_RATE_LIMIT_POINTS') return 7;
      return undefined;
    });

    const customGuard = new AiChatRateLimitGuard(
      limiters,
      config as unknown as ConfigService,
      reflector as unknown as Reflector,
    );

    expect(
      (
        customGuard as unknown as {
          pointsByToolSet: Record<string, number>;
        }
      ).pointsByToolSet['marketplace-assistant'],
    ).toBe(7);
  });

  it('defaults to 20 marketplace-assistant points when unconfigured', () => {
    config.get.mockReturnValue(undefined);

    const defaultGuard = new AiChatRateLimitGuard(
      limiters,
      config as unknown as ConfigService,
      reflector as unknown as Reflector,
    );

    expect(
      (defaultGuard as unknown as { pointsByToolSet: Record<string, number> })
        .pointsByToolSet['marketplace-assistant'],
    ).toBe(20);
  });

  describe('per-tool-set buckets (#645)', () => {
    it('defaults to the marketplace-assistant limiter when a route carries no @ToolSet metadata', async () => {
      marketplaceLimiter.consume.mockResolvedValue({
        remainingPoints: 19,
        msBeforeNext: 0,
      });
      const { context } = makeContext({ user: { userId: 'user-1' } });

      await guard.canActivate(context);

      expect(marketplaceLimiter.consume).toHaveBeenCalledWith('user:user-1', 1);
      expect(copilotLimiter.consume).not.toHaveBeenCalled();
    });

    it('routes a creator-copilot-tagged route to its own limiter', async () => {
      copilotLimiter.consume.mockResolvedValue({
        remainingPoints: 4,
        msBeforeNext: 0,
      });
      const { context } = makeContext({
        user: { userId: 'user-1' },
        toolSet: 'creator-copilot',
      });

      await guard.canActivate(context);

      expect(copilotLimiter.consume).toHaveBeenCalledWith('user:user-1', 1);
      expect(marketplaceLimiter.consume).not.toHaveBeenCalled();
    });

    it('exhausting the marketplace-assistant bucket does not reject a creator-copilot request for the same user', async () => {
      marketplaceLimiter.consume.mockRejectedValue({
        remainingPoints: 0,
        msBeforeNext: 5000,
      });
      copilotLimiter.consume.mockResolvedValue({
        remainingPoints: 4,
        msBeforeNext: 0,
      });

      const { context: marketplaceContext } = makeContext({
        user: { userId: 'user-1' },
      });
      await expect(guard.canActivate(marketplaceContext)).rejects.toThrow(
        HttpException,
      );

      const { context: copilotContext } = makeContext({
        user: { userId: 'user-1' },
        toolSet: 'creator-copilot',
      });
      await expect(guard.canActivate(copilotContext)).resolves.toBe(true);
    });

    it('exhausting the creator-copilot bucket does not reject a marketplace-assistant request for the same user', async () => {
      copilotLimiter.consume.mockRejectedValue({
        remainingPoints: 0,
        msBeforeNext: 5000,
      });
      marketplaceLimiter.consume.mockResolvedValue({
        remainingPoints: 19,
        msBeforeNext: 0,
      });

      const { context: copilotContext } = makeContext({
        user: { userId: 'user-1' },
        toolSet: 'creator-copilot',
      });
      await expect(guard.canActivate(copilotContext)).rejects.toThrow(
        HttpException,
      );

      const { context: marketplaceContext } = makeContext({
        user: { userId: 'user-1' },
      });
      await expect(guard.canActivate(marketplaceContext)).resolves.toBe(true);
    });

    it('gives creator-copilot a stricter default budget than marketplace-assistant', () => {
      config.get.mockReturnValue(undefined);
      const defaultGuard = new AiChatRateLimitGuard(
        limiters,
        config as unknown as ConfigService,
        reflector as unknown as Reflector,
      );
      const points = (
        defaultGuard as unknown as { pointsByToolSet: Record<string, number> }
      ).pointsByToolSet;

      expect(points['creator-copilot']).toBeLessThan(
        points['marketplace-assistant'],
      );
    });

    it('reads the creator-copilot points threshold from AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT', () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_RATE_LIMIT_POINTS_CREATOR_COPILOT') return 2;
        return undefined;
      });
      const customGuard = new AiChatRateLimitGuard(
        limiters,
        config as unknown as ConfigService,
        reflector as unknown as Reflector,
      );

      expect(
        (
          customGuard as unknown as {
            pointsByToolSet: Record<string, number>;
          }
        ).pointsByToolSet['creator-copilot'],
      ).toBe(2);
    });

    it("reports the active tool set's own point budget in X-RateLimit-Limit", async () => {
      copilotLimiter.consume.mockResolvedValue({
        remainingPoints: 4,
        msBeforeNext: 0,
      });
      const { context, res } = makeContext({
        user: { userId: 'user-1' },
        toolSet: 'creator-copilot',
      });

      await guard.canActivate(context);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    });
  });
});
