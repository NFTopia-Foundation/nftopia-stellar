import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('AppController', () => {
  let appController: AppController;
  let cacheManager: any;

  beforeEach(async () => {
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    cacheManager = app.get(CACHE_MANAGER);
  });

  describe('root / health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();

      expect(result).toHaveProperty('status', 'OK');
      expect(result).toHaveProperty('timestamp');

      // keeps compatibility with the other version
      expect(result.status).toBe('OK');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('cache-test', () => {
    it('should return cache miss on first call', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await appController.testCache();

      expect(result.cacheHit).toBe(false);
      expect(result.message).toContain('cache miss');
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return cache hit when value exists', async () => {
      const cachedData = {
        data: 'test',
        generatedAt: '2026-01-22T12:00:00.000Z',
        randomNumber: 123,
      };

      cacheManager.get.mockResolvedValue(cachedData);

      const result = await appController.testCache();

      expect(result.cacheHit).toBe(true);
      expect(result.message).toContain('retrieved from Redis');
    });
  });
});
