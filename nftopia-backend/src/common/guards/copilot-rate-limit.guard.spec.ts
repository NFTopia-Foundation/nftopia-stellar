import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CopilotRateLimitGuard } from './copilot-rate-limit.guard';
import type { RateLimiterClient } from './rate-limiter-client.interface';

describe('CopilotRateLimitGuard', () => {
  let guard: CopilotRateLimitGuard;

  const limiter: jest.Mocked<RateLimiterClient> = {
    consume: jest.fn(),
  };

  const config = {
    get: jest.fn(),
  };

  const makeContext = (
    overrides: {
      user?: { userId?: string };
      ip?: string;
      forwardedFor?: string;
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

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, req, res };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_COPILOT_RATE_LIMIT_POINTS') return 5;
      return undefined;
    });

    guard = new CopilotRateLimitGuard(
      limiter,
      config as unknown as ConfigService,
    );
  });

  it('allows an under-limit request and sets rate limit headers', async () => {
    limiter.consume.mockResolvedValue({ remainingPoints: 4, msBeforeNext: 0 });
    const { context, res } = makeContext({ user: { userId: 'user-1' } });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Retry-After',
      expect.anything(),
    );
  });

  it('rejects an over-limit request with 429 and sets Retry-After / remaining=0', async () => {
    limiter.consume.mockRejectedValue({
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
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('keys the limiter by the authenticated user id, using its own key prefix (independent of AiChatRateLimitGuard)', async () => {
    limiter.consume.mockResolvedValue({ remainingPoints: 4, msBeforeNext: 0 });
    const { context } = makeContext({ user: { userId: 'user-42' } });

    await guard.canActivate(context);

    expect(limiter.consume).toHaveBeenCalledWith('user:user-42', 1);
  });

  it('falls back to IP keying when no authenticated user is present', async () => {
    limiter.consume.mockResolvedValue({ remainingPoints: 4, msBeforeNext: 0 });
    const { context } = makeContext({ ip: '203.0.113.5' });

    await guard.canActivate(context);

    expect(limiter.consume).toHaveBeenCalledWith('ip:203.0.113.5', 1);
  });

  it('reads the points threshold from AI_COPILOT_RATE_LIMIT_POINTS', () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_COPILOT_RATE_LIMIT_POINTS') return 2;
      return undefined;
    });

    const customGuard = new CopilotRateLimitGuard(
      limiter,
      config as unknown as ConfigService,
    );

    expect((customGuard as unknown as { points: number }).points).toBe(2);
  });

  it('defaults to 5 points (tighter than the 20-point chat limiter) when unconfigured', () => {
    config.get.mockReturnValue(undefined);

    const defaultGuard = new CopilotRateLimitGuard(
      limiter,
      config as unknown as ConfigService,
    );

    expect((defaultGuard as unknown as { points: number }).points).toBe(5);
  });
});
