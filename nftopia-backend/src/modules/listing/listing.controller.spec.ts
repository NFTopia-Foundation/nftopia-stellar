import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { ListingStatus } from './interfaces/listing.interface';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByNft: jest.fn(),
  create: jest.fn(),
  cancel: jest.fn(),
  buy: jest.fn(),
};

const guardMock = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const httpContext = context.switchToHttp() as unknown as {
      getRequest: () => { user?: { userId?: string } };
    };
    const request = httpContext.getRequest();
    return Boolean(request.user?.userId);
  }),
};

describe('ListingController', () => {
  let controller: ListingController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingController],
      providers: [
        { provide: ListingService, useValue: mockService },
        { provide: JwtAuthGuard, useValue: guardMock },
      ],
    }).compile();

    controller = module.get<ListingController>(ListingController);
  });

  it('list forwards query to service', async () => {
    const query: ListingQueryDto = {
      status: ListingStatus.ACTIVE,
      page: 2,
      limit: 10,
    };
    mockService.findAll.mockResolvedValue([{ id: 'l1' }]);

    const result = await controller.list(query);

    expect(mockService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'l1' }]);
  });

  it('active enforces ACTIVE status', async () => {
    const query: ListingQueryDto = { sellerId: 'seller-1' };
    mockService.findAll.mockResolvedValue([{ id: 'l1' }]);

    const result = await controller.active(query);

    expect(mockService.findAll).toHaveBeenCalledWith({
      ...query,
      status: ListingStatus.ACTIVE,
    });
    expect(result).toEqual([{ id: 'l1' }]);
  });

  it('get resolves listing by id', async () => {
    mockService.findOne.mockResolvedValue({ id: 'l1' });

    const result = await controller.get('l1');

    expect(mockService.findOne).toHaveBeenCalledWith('l1');
    expect(result).toEqual({ id: 'l1' });
  });

  it('byNft splits nft id and forwards contract/token ids', async () => {
    mockService.findByNft.mockResolvedValue([{ id: 'l1' }]);

    const result = await controller.byNft('C1:1');

    expect(mockService.findByNft).toHaveBeenCalledWith('C1', '1');
    expect(result).toEqual([{ id: 'l1' }]);
  });

  it('create extracts sellerId from request user', async () => {
    const dto: CreateListingDto = {
      nftContractId: 'C1',
      nftTokenId: '1',
      price: 10,
    };
    mockService.create.mockResolvedValue({ id: 'l1' });

    const result = await controller.create(dto, {
      user: { userId: 'seller-1' },
    } as never);

    expect(mockService.create).toHaveBeenCalledWith(dto, 'seller-1');
    expect(result).toEqual({ id: 'l1' });
  });

  it('create forwards undefined sellerId when request user is missing', async () => {
    const dto: CreateListingDto = {
      nftContractId: 'C1',
      nftTokenId: '1',
      price: 10,
    };
    mockService.create.mockResolvedValue({ id: 'l1' });

    await controller.create(dto, {} as never);

    expect(mockService.create).toHaveBeenCalledWith(dto, undefined);
  });

  it('cancel extracts caller id from request user', async () => {
    mockService.cancel.mockResolvedValue({
      id: 'l1',
      status: ListingStatus.CANCELLED,
    });

    const result = await controller.cancel('l1', {
      user: { userId: 'seller-1' },
    } as never);

    expect(mockService.cancel).toHaveBeenCalledWith('l1', 'seller-1');
    expect(result).toEqual({ id: 'l1', status: ListingStatus.CANCELLED });
  });

  it('cancel forwards undefined caller id when request user is missing', async () => {
    mockService.cancel.mockResolvedValue({
      id: 'l1',
      status: ListingStatus.CANCELLED,
    });

    await controller.cancel('l1', {} as never);

    expect(mockService.cancel).toHaveBeenCalledWith('l1', undefined);
  });

  it('buy extracts buyer id from request user', async () => {
    mockService.buy.mockResolvedValue({ success: true });

    const result = await controller.buy('l1', {
      user: { userId: 'buyer-1' },
    } as never);

    expect(mockService.buy).toHaveBeenCalledWith('l1', 'buyer-1');
    expect(result).toEqual({ success: true });
  });

  it('buy forwards undefined buyer id when request user is missing', async () => {
    mockService.buy.mockResolvedValue({ success: false });

    await controller.buy('l1', {} as never);

    expect(mockService.buy).toHaveBeenCalledWith('l1', undefined);
  });

  it('mocked jwt guard allows authenticated requests', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'user-1' } }),
      }),
    } as ExecutionContext;

    expect(guardMock.canActivate(context)).toBe(true);
  });

  it('mocked jwt guard blocks unauthenticated requests (401 path)', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: undefined }),
      }),
    } as ExecutionContext;

    expect(guardMock.canActivate(context)).toBe(false);
  });
});
