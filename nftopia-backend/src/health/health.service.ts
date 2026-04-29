import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
  ) {}

  checkLive(): Promise<{ status: string; timestamp: string }> {
    return Promise.resolve({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  async checkReady(): Promise<{
    status: string;
    details: { postgres: string; redis: string };
    timestamp: string;
  }> {
    const postgresStatus = await this.checkPostgres();
    const redisStatus = await this.checkRedis();

    const isHealthy = postgresStatus === 'up' && redisStatus === 'up';

    if (!isHealthy) {
      this.logger.error(
        `Health check failed: Postgres: ${postgresStatus}, Redis: ${redisStatus}`,
      );
    }

    return {
      status: isHealthy ? 'ok' : 'error',
      details: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<string> {
    try {
      if (!this.dataSource.isInitialized) {
        return 'down';
      }
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch (error) {
      this.logger.error('Postgres health check failed', error);
      return 'down';
    }
  }

  private async checkRedis(): Promise<string> {
    try {
      const testKey = 'health-check-test';
      const testValue = 'ok';
      await this.cacheManager.set(testKey, testValue);
      const result = await this.cacheManager.get(testKey);
      return result === testValue ? 'up' : 'down';
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return 'down';
    }
  }
}
