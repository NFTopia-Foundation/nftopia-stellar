import { Test, TestingModule } from '@nestjs/testing';
import { AuctionsController } from './auctions.controller';

describe('AuctionsController', () => {
  let controller: AuctionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuctionsController],
    }).compile();

    controller = module.get<AuctionsController>(AuctionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
