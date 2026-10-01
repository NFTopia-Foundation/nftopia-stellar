import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { ConnectionStates, type Connection } from 'mongoose';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
    @InjectConnection() private mongoConnection: Connection,
  ) {}

  checkLive(): Promise<{ status: string; timestamp: string }> {
    return Promise.resolve({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  async checkReady(): Promise<{
    status: string;
    details: { postgres: string; redis: string; mongodb: string };
    timestamp: string;
  }> {
    const postgresStatus = await this.checkPostgres();
    const redisStatus = await this.checkRedis();
    const mongoStatus = await this.checkMongo();

    // Postgres and Redis are on the request-serving critical path, so
    // either being down fails readiness. MongoDB (#531) only backs the
    // analytics/event store — a non-critical subsystem — so its status is
    // reported for observability without gating overall readiness; that
    // would otherwise fail k8s probes and cycle pods over an outage in a
    // system nothing on the request path depends on.
    const isHealthy = postgresStatus === 'up' && redisStatus === 'up';

    if (!isHealthy) {
      this.logger.error(
        `Health check failed: Postgres: ${postgresStatus}, Redis: ${redisStatus}`,
      );
    }
    if (mongoStatus !== 'up') {
      this.logger.warn(`MongoDB health check reported: ${mongoStatus}`);
    }

    return {
      status: isHealthy ? 'ok' : 'error',
      details: {
        postgres: postgresStatus,
        redis: redisStatus,
        mongodb: mongoStatus,
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

  private async checkMongo(): Promise<string> {
    try {
      // db is undefined until the connection reaches `connected`, so this
      // also guards the ping below from a "Cannot read properties of
      // undefined" error while the connection is still starting/retrying.
      if (
        this.mongoConnection.readyState !== ConnectionStates.connected ||
        !this.mongoConnection.db
      ) {
        return 'down';
      }
      await this.mongoConnection.db.admin().ping();
      return 'up';
    } catch (error) {
      this.logger.error('MongoDB health check failed', error);
      return 'down';
    }
  }
}
