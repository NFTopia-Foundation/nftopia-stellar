import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import Anthropic from '@anthropic-ai/sdk';

/** How long to wait for Anthropic to answer before treating it as down. */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** Model used for the reachability probe — must exist so a 404 doesn't look like an outage. */
const HEALTH_CHECK_MODEL = 'claude-opus-5';

/**
 * How long a probed status is reused before the next checkAnthropic() call
 * re-probes Anthropic. AiAgentService.chat()/chatStream() call this on every
 * request (#643) to short-circuit while Anthropic is down, so without this
 * cache every chat message would pay for its own reachability round-trip —
 * up to the full HEALTH_CHECK_TIMEOUT_MS when Anthropic is actually down,
 * which is the opposite of the fast failure that check is meant to give.
 * Short enough that a real recovery isn't masked for long. Shared via the
 * app's Redis-backed CACHE_MANAGER so every backend instance (and GET
 * /ai/health) sees the same result instead of each probing independently.
 */
const HEALTH_CACHE_TTL_MS = 10_000;
const HEALTH_CACHE_KEY = 'ai-agent:anthropic-health-status';

export type AnthropicHealthStatus = 'up' | 'down' | 'unconfigured';

/**
 * Reports whether the Anthropic API is currently reachable, without
 * incurring generation cost. Kept separate from AiAgentService/HealthService
 * so a probe failure here can never affect either the AI agent's own
 * request path or the overall /health/ready readiness probe.
 */
@Injectable()
export class AiAgentHealthService {
  private readonly logger = new Logger(AiAgentHealthService.name);
  private readonly client = new Anthropic();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Cheap reachability check: retrieves model metadata instead of sending a
   * billed generation request, and reuses a cached result within
   * HEALTH_CACHE_TTL_MS instead of re-probing. Never throws — mirrors the
   * try/catch-and-return-status pattern in HealthService.checkPostgres/
   * checkRedis.
   */
  async checkAnthropic(): Promise<AnthropicHealthStatus> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return 'unconfigured';
    }

    const cached =
      await this.cacheManager.get<AnthropicHealthStatus>(HEALTH_CACHE_KEY);
    if (cached) {
      return cached;
    }

    let status: AnthropicHealthStatus;
    try {
      await this.client.models.retrieve(HEALTH_CHECK_MODEL, null, {
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      status = 'up';
    } catch (error) {
      this.logger.error('Anthropic health check failed', error as Error);
      status = 'down';
    }

    await this.cacheManager.set(HEALTH_CACHE_KEY, status, HEALTH_CACHE_TTL_MS);
    return status;
  }

  async getHealth(): Promise<{
    status: AnthropicHealthStatus;
    timestamp: string;
  }> {
    const status = await this.checkAnthropic();
    return {
      status,
      timestamp: new Date().toISOString(),
    };
  }
}
