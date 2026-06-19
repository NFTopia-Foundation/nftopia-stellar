import Redis from 'ioredis';

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedisMigrationLock {
  private readonly redis: Redis;
  private readonly key: string;
  private readonly ttlMs: number;
  private lockToken: string | null = null;

  constructor() {
    this.key = process.env.MIGRATION_LOCK_KEY || 'nftopia:db:migration-lock';
    this.ttlMs = parseInt(process.env.MIGRATION_LOCK_TTL_MS || '300000', 10);
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  async acquire(): Promise<boolean> {
    await this.redis.connect();

    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await this.redis.set(
      this.key,
      token,
      'PX',
      this.ttlMs,
      'NX',
    );

    if (result !== 'OK') {
      return false;
    }

    this.lockToken = token;
    return true;
  }

  async release(): Promise<void> {
    if (this.lockToken) {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, this.key, this.lockToken);
      this.lockToken = null;
    }

    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
