import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

const UNLOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

interface InMemoryLockEntry {
  token: string;
  expiresAt: number;
}

@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private redis: Redis | null = null;
  private readonly inMemoryLocks = new Map<string, InMemoryLockEntry>();
  private readonly ownsRedis: boolean = false;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() redisClient?: Redis,
  ) {
    if (redisClient) {
      this.redis = redisClient;
      this.ownsRedis = false;
    } else if (this.configService) {
      const redisHost = this.configService.get<string>('REDIS_HOST');
      if (redisHost) {
        try {
          const redisPort = Number(
            this.configService.get<string | number>('REDIS_PORT') ?? 6379,
          );
          const redisPassword =
            this.configService.get<string>('REDIS_PASSWORD') || undefined;
          const redisDb = Number(
            this.configService.get<string | number>('REDIS_DB') ?? 0,
          );

          this.redis = new Redis({
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            db: redisDb,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
          });
          this.ownsRedis = true;

          this.redis.on('error', (err) => {
            this.logger.warn(
              `Redis connection error in DistributedLockService: ${err.message}`,
            );
          });
        } catch (err) {
          this.logger.warn(
            `Failed to initialize Redis in DistributedLockService, fallback to in-memory: ${err}`,
          );
          this.redis = null;
        }
      }
    }
  }

  /**
   * Attempts to acquire an exclusive lock on the given key for the specified TTL.
   * Returns a unique token string if the lock was acquired, or null if already held.
   */
  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();

    if (this.redis) {
      try {
        const res = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
        if (res === 'OK') {
          return token;
        }
        return null;
      } catch (err) {
        this.logger.warn(
          `Redis lock acquire failed for ${key}, falling back to in-memory: ${(err as Error).message}`,
        );
      }
    }

    // In-memory fallback (used in test or when Redis is absent)
    const now = Date.now();
    const existing = this.inMemoryLocks.get(key);
    if (existing && existing.expiresAt > now) {
      return null;
    }

    this.inMemoryLocks.set(key, { token, expiresAt: now + ttlMs });
    return token;
  }

  /**
   * Releases the lock for the given key only if the token matches.
   * Returns true if released, false if the token did not match or lock expired.
   */
  async release(key: string, token: string): Promise<boolean> {
    if (this.redis) {
      try {
        const res = await this.redis.eval(UNLOCK_SCRIPT, 1, key, token);
        return res === 1;
      } catch (err) {
        this.logger.warn(
          `Redis lock release failed for ${key}: ${(err as Error).message}`,
        );
      }
    }

    // In-memory fallback
    const existing = this.inMemoryLocks.get(key);
    if (existing && existing.token === token) {
      this.inMemoryLocks.delete(key);
      return true;
    }
    return false;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.ownsRedis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore errors on shutdown
      }
    }
  }
}
