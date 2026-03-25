import { Test, TestingModule } from '@nestjs/testing';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { AuctionQueryDto } from './dto/auction-query.dto';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getBids: jest.fn(),
  create: jest.fn(),
  placeBid: jest.fn(),
  cancelAuction: jest.fn(),
  settleAuction: jest.fn(),
};

describe('AuctionController', () => {
  let controller: AuctionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuctionController],
      providers: [{ provide: AuctionService, useValue: mockService }],
    }).compile();

    controller = module.get<AuctionController>(AuctionController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls findAll', async () => {
    mockService.findAll.mockResolvedValueOnce([]);
    const q: AuctionQueryDto = {} as unknown as AuctionQueryDto;
    const res = await controller.list(q);
    expect(mockService.findAll).toHaveBeenCalledWith(q);
    expect(res).toEqual([]);
  });

  it('calls active', async () => {
    mockService.findAll.mockResolvedValueOnce([]);
    const q: AuctionQueryDto = {} as unknown as AuctionQueryDto;
    await controller.active(q);
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('calls get auction and bids', async () => {
    mockService.findOne.mockResolvedValueOnce({ id: 'a1' });
    const a = await controller.get('a1');
    expect(a).toEqual({ id: 'a1' });
    mockService.getBids.mockResolvedValueOnce([]);
    const b = await controller.bids('a1');
    expect(b).toEqual([]);
  });
});
