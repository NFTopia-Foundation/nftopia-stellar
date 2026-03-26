import { Test, TestingModule } from '@nestjs/testing';
import { ListingService } from './listing.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { ListingStatus } from './interfaces/listing.interface';
import { CreateListingDto } from './dto/create-listing.dto';

const mockListingRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest
    .fn()
    .mockImplementation((dto: CreateListingDto) => dto as unknown as Listing),
  save: jest.fn().mockImplementation((a: Listing) => Promise.resolve(a)),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
};

const mockNftRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
};

describe('ListingService', () => {
  let service: ListingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
      ],
    }).compile();

    service = module.get<ListingService>(ListingService);
    jest.clearAllMocks();
  });

  it('creates a listing', async () => {
    mockListingRepo.findOne.mockResolvedValueOnce(null);
    mockNftRepo.findOne.mockResolvedValueOnce({
      contractId: 'C',
      tokenId: 'T',
    });
    const dto: CreateListingDto = {
      nftContractId: 'C',
      nftTokenId: 'T',
      price: 1,
    } as CreateListingDto;
    const res = await service.create(dto, 'seller1');
    expect(mockListingRepo.create).toHaveBeenCalled();
    expect(mockListingRepo.save).toHaveBeenCalled();
    expect(res.sellerId).toBe('seller1');
  });

  it('prevents duplicate listing', async () => {
    mockListingRepo.findOne.mockResolvedValueOnce({ id: 'exists' });
    await expect(
      service.create(
        { nftContractId: 'C', nftTokenId: 'T', price: 1 } as CreateListingDto,
        's',
      ),
    ).rejects.toThrow();
  });

  it('cancels only by seller', async () => {
    const listing = {
      id: 'l1',
      sellerId: 's1',
      status: ListingStatus.ACTIVE,
    } as Listing;
    mockListingRepo.findOne.mockResolvedValue(listing);
    await expect(service.cancel('l1', 'other')).rejects.toThrow();
    await expect(service.cancel('l1', 's1')).resolves.toBeDefined();
  });

  it('buys listing and transfers nft', async () => {
    const listing = {
      id: 'l1',
      nftContractId: 'C',
      nftTokenId: 'T',
      status: ListingStatus.ACTIVE,
    } as Listing;
    mockListingRepo.findOne.mockResolvedValueOnce(listing);
    mockNftRepo.findOne.mockResolvedValueOnce({
      contractId: 'C',
      tokenId: 'T',
      owner: 'old',
    });
    const res = await service.buy('l1', 'buyer1');
    expect(res.success).toBe(true);
    expect(mockNftRepo.save).toHaveBeenCalled();
    expect(mockListingRepo.save).toHaveBeenCalled();
  });
});
