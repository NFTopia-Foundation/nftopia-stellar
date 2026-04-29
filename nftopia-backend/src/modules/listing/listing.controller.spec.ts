import { Test, TestingModule } from '@nestjs/testing';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { ListingQueryDto } from './dto/listing-query.dto';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByNft: jest.fn(),
  create: jest.fn(),
  cancel: jest.fn(),
  buy: jest.fn(),
};

describe('ListingController', () => {
  let controller: ListingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingController],
      providers: [{ provide: ListingService, useValue: mockService }],
    }).compile();

    controller = module.get<ListingController>(ListingController);
    jest.clearAllMocks();
  });

  it('listings list', async () => {
    mockService.findAll.mockResolvedValueOnce([]);
    const q: ListingQueryDto = {} as ListingQueryDto;
    const res = await controller.list(q);
    expect(mockService.findAll).toHaveBeenCalledWith(q);
    expect(res).toEqual([]);
  });

  it('get by id and by nft', async () => {
    mockService.findOne.mockResolvedValueOnce({ id: 'l1' });
    const l = await controller.get('l1');
    expect(l).toEqual({ id: 'l1' });
    mockService.findByNft.mockResolvedValueOnce([]);
    const b = await controller.byNft('C:T');
    expect(b).toEqual([]);
  });
});
