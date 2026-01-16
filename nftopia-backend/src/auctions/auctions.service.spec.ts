import { Test, TestingModule } from '@nestjs/testing';
import { AuctionsService } from './auctions.service';

describe('AuctionsService', () => {
  let service: AuctionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuctionsService],
    }).compile();

    service = module.get<AuctionsService>(AuctionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
