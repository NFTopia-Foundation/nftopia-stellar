import { Test, TestingModule } from '@nestjs/testing';
import { StarknetService } from './starknet.service';

describe('StarknetService', () => {
  let service: StarknetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StarknetService],
    }).compile();

    service = module.get<StarknetService>(StarknetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
