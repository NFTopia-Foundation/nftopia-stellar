import { Test, TestingModule } from '@nestjs/testing';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';

const mockNftService = {
  findAll: jest.fn().mockResolvedValue([]),
  getPopular: jest.fn().mockResolvedValue([]),
  getTopSellers: jest.fn().mockResolvedValue([]),
};

describe('NftController', () => {
  let controller: NftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NftController],
      providers: [
        {
          provide: NftService,
          useValue: mockNftService,
        },
      ],
    }).compile();

    controller = module.get<NftController>(NftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list NFTs', async () => {
    expect(await controller.findAll({})).toEqual([]);
    expect(mockNftService.findAll).toHaveBeenCalled();
  });

  it('should get popular NFTs', async () => {
    expect(await controller.getPopular()).toEqual([]);
    expect(mockNftService.getPopular).toHaveBeenCalled();
  });
});
