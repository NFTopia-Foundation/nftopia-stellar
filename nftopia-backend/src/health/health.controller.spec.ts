import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { getConnectionToken } from '@nestjs/mongoose';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockDataSource = {
    isInitialized: true,
    query: jest.fn(),
  };

  const mockPing = jest.fn();
  const mockMongoConnection = {
    readyState: 1,
    db: {
      admin: () => ({ ping: mockPing }),
    },
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
        {
          provide: getConnectionToken(),
          useValue: mockMongoConnection,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
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
    beforeEach(() => {
      mockMongoConnection.readyState = 1;
      mockPing.mockResolvedValue({ ok: 1 });
    });

    it('should return data when healthy', async () => {
      mockDataSource.query.mockResolvedValue([{ '1': 1 }]);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue('ok');

      const result = await controller.getReady();

      expect(result).toHaveProperty('status', 'ok');
      expect(result.details.postgres).toBe('up');
      expect(result.details.redis).toBe('up');
      expect(result.details.mongodb).toBe('up');
    });

    it('should throw ServiceUnavailableException when unhealthy', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB Down'));

      await expect(controller.getReady()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    // MongoDB (#531) coverage — see health.service.ts's checkReady() for
    // why it's reported but non-blocking: it backs the analytics/event
    // store only, not the request-serving critical path.
    describe('MongoDB reporting (#531)', () => {
      it('reports mongodb: down when the connection is not ready, without failing overall readiness', async () => {
        mockDataSource.query.mockResolvedValue([{ '1': 1 }]);
        mockCacheManager.set.mockResolvedValue(undefined);
        mockCacheManager.get.mockResolvedValue('ok');
        mockMongoConnection.readyState = 0;

        const result = await controller.getReady();

        expect(result.status).toBe('ok');
        expect(result.details.mongodb).toBe('down');
      });

      it('reports mongodb: down when the admin ping fails, without failing overall readiness', async () => {
        mockDataSource.query.mockResolvedValue([{ '1': 1 }]);
        mockCacheManager.set.mockResolvedValue(undefined);
        mockCacheManager.get.mockResolvedValue('ok');
        mockPing.mockRejectedValue(new Error('Mongo down'));

        const result = await controller.getReady();

        expect(result.status).toBe('ok');
        expect(result.details.mongodb).toBe('down');
      });
    });
  });
});
