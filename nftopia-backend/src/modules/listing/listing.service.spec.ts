import { Test, TestingModule } from '@nestjs/testing';
import { ListingService } from './listing.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { ListingStatus } from './interfaces/listing.interface';
import { CreateListingDto } from './dto/create-listing.dto';
import { ConfigService } from '@nestjs/config';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';

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

const mockTransactionService = {
  createAndExecuteListingPurchase: jest.fn(),
};

describe('ListingService', () => {
  let service: ListingService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    };
    const mockSettlementClient = {
      createSale: jest.fn(),
      executeSale: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: MarketplaceSettlementClient,
          useValue: mockSettlementClient,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideProvider(MarketplaceSettlementClient)
      .useValue(mockSettlementClient)
      .overrideProvider(TransactionService)
      .useValue(mockTransactionService)
      .compile();

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
    const mockTransaction = {
      id: 1,
      state: TransactionState.COMPLETED,
    };
    mockListingRepo.findOne.mockResolvedValueOnce(listing);
    mockTransactionService.createAndExecuteListingPurchase.mockResolvedValueOnce(
      mockTransaction,
    );
    const res = await service.buy('l1', 'buyer1');
    expect(res.success).toBe(true);
    expect(res.transactionId).toBe(1);
    expect(res.transactionState).toBe(TransactionState.COMPLETED);
  });
});
