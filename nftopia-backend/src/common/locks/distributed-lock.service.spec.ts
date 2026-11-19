import { DistributedLockService } from './distributed-lock.service';
import Redis from 'ioredis';

describe('DistributedLockService', () => {
  describe('In-memory mode', () => {
    let service: DistributedLockService;

    beforeEach(() => {
      service = new DistributedLockService();
    });

    it('should acquire lock when free and return token', async () => {
      const token = await service.acquire('test-lock', 5000);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should return null if lock is already held', async () => {
      const token1 = await service.acquire('test-lock', 5000);
      expect(token1).toBeDefined();

      const token2 = await service.acquire('test-lock', 5000);
      expect(token2).toBeNull();
    });

    it('should allow acquiring lock again after release', async () => {
      const token1 = await service.acquire('test-lock', 5000);
      expect(token1).toBeDefined();

      const released = await service.release('test-lock', token1!);
      expect(released).toBe(true);

      const token2 = await service.acquire('test-lock', 5000);
      expect(token2).toBeDefined();
    });

    it('should not release lock if token does not match', async () => {
      const token = await service.acquire('test-lock', 5000);
      expect(token).toBeDefined();

      const released = await service.release('test-lock', 'wrong-token');
      expect(released).toBe(false);

      // Lock should still be held
      const token2 = await service.acquire('test-lock', 5000);
      expect(token2).toBeNull();
    });

    it('should allow acquiring lock after TTL expires', async () => {
      const token1 = await service.acquire('test-lock', 10); // 10ms
      expect(token1).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 20));

      const token2 = await service.acquire('test-lock', 5000);
      expect(token2).toBeDefined();
    });
  });

  describe('Redis mode', () => {
    let fakeRedis: {
      set: jest.Mock;
      eval: jest.Mock;
      quit: jest.Mock;
      on: jest.Mock;
    };
    let service: DistributedLockService;

    beforeEach(() => {
      fakeRedis = {
        set: jest.fn(),
        eval: jest.fn(),
        quit: jest.fn(),
        on: jest.fn(),
      };
      service = new DistributedLockService(
        undefined,
        fakeRedis as unknown as Redis,
      );
    });

    it('should acquire lock using Redis SET NX PX and return token on OK', async () => {
      fakeRedis.set.mockResolvedValue('OK');

      const token = await service.acquire('test-key', 3000);
      expect(token).toBeDefined();
      expect(fakeRedis.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        'PX',
        3000,
        'NX',
      );
    });

    it('should return null when Redis SET fails (lock held)', async () => {
      fakeRedis.set.mockResolvedValue(null);

      const token = await service.acquire('test-key', 3000);
      expect(token).toBeNull();
    });

    it('should release lock using Redis EVAL Lua script', async () => {
      fakeRedis.eval.mockResolvedValue(1);

      const result = await service.release('test-key', 'token-123');
      expect(result).toBe(true);
      expect(fakeRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'test-key',
        'token-123',
      );
    });

    it('should return false if Redis EVAL returns 0 (token mismatch or expired)', async () => {
      fakeRedis.eval.mockResolvedValue(0);

      const result = await service.release('test-key', 'token-123');
      expect(result).toBe(false);
    });

    it('should fall back to in-memory lock if Redis set throws', async () => {
      fakeRedis.set.mockRejectedValue(new Error('Redis connection lost'));

      const token = await service.acquire('test-key', 3000);
      expect(token).toBeDefined();
    });
  });
});
