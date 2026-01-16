import { Test, TestingModule } from '@nestjs/testing';
import { StarknetController } from './starknet.controller';

describe('StarknetController', () => {
  let controller: StarknetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StarknetController],
    }).compile();

    controller = module.get<StarknetController>(StarknetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
