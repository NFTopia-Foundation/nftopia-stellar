import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockDataSource = {
    isInitialized: true,
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLive', () => {
    it('should return ok', async () => {
      const result = await controller.getLive();
      expect(result.status).toBe('ok');
    });
  });

  describe('getReady', () => {
    it('should return data when healthy', async () => {
      mockDataSource.query.mockResolvedValue([{ '1': 1 }]);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue('ok');

      const result = await controller.getReady();

      expect(result).toHaveProperty('status', 'ok');
      expect(result.details.postgres).toBe('up');
      expect(result.details.redis).toBe('up');
    });

    it('should throw ServiceUnavailableException when unhealthy', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB Down'));

      await expect(controller.getReady()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
