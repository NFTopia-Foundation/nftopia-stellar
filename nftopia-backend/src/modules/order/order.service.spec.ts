import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    };
    const mockSettlementClient = {
      createTrade: jest.fn(),
      createBundle: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useClass: Repository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MarketplaceSettlementClient,
          useValue: mockSettlementClient,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
