import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AppService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  async testCache(): Promise<{
    message: string;
    cacheHit: boolean;
    cachedValue: any;
    timestamp: string;
  }> {
    const cacheKey = 'test-cache-key';

    const cachedValue = await this.cacheManager.get(cacheKey);

    if (cachedValue) {
      return {
        message: 'Value retrieved from Redis cache',
        cacheHit: true,
        cachedValue,
        timestamp: new Date().toISOString(),
      };
    }

    // If not in cache, set a new value
    const newValue = {
      data: 'Hello from Redis!',
      generatedAt: new Date().toISOString(),
      randomNumber: Math.floor(Math.random() * 1000),
    };

    await this.cacheManager.set(cacheKey, newValue);

    return {
      message: 'Value set in Redis cache (cache miss)',
      cacheHit: false,
      cachedValue: newValue,
      timestamp: new Date().toISOString(),
    };
  }
}
