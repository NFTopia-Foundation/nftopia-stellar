import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('AppController', () => {
  let appController: AppController;
  let cacheManager: Cache;
  let moduleRef: TestingModule & {
    get<TInput = any>(typeOrToken: any): TInput;
  };

  beforeEach(async () => {
    moduleRef = (await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile()) as TestingModule & {
      get<TInput = any>(typeOrToken: any): TInput;
    };

    appController = moduleRef.get<AppController>(AppController);
    cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);
  });

  it('should test cache miss', async () => {
    (cacheManager.get as jest.Mock).mockResolvedValue(null);
    const result = await appController.testCache();
    expect(result.cacheHit).toBe(false);
    expect(cacheManager.set).toHaveBeenCalled();
  });
});
