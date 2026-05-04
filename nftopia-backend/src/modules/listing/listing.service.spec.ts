import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateListingDto } from './dto/create-listing.dto';
import { Listing } from './entities/listing.entity';
import { ListingStatus } from './interfaces/listing.interface';
import { ListingService } from './listing.service';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { TransactionService } from '../transaction/transaction.service';

type MockQb = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
  getCount: jest.Mock;
};

const makeQb = (): MockQb => {
  const qb: Partial<MockQb> = {};
  qb.where = jest.fn().mockImplementation((clause: unknown) => {
    if (
      clause &&
      typeof clause === 'object' &&
      'whereFactory' in (clause as Record<string, unknown>) &&
      typeof (clause as { whereFactory?: unknown }).whereFactory === 'function'
    ) {
      (
        clause as { whereFactory: (builder: { orWhere: jest.Mock }) => void }
      ).whereFactory({
        orWhere: qb.orWhere as jest.Mock,
      });
    }
    return qb;
  });
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.addOrderBy = jest.fn().mockReturnValue(qb);
  qb.skip = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getCount = jest.fn().mockResolvedValue(0);
  return qb as MockQb;
};

describe('ListingService', () => {
  let service: ListingService;

  const listingRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const nftRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const settlementClient = {
    createSale: jest.fn(),
    executeSale: jest.fn(),
  };

  const transactionService = {
    createAndExecuteListingPurchase: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: getRepositoryToken(Listing), useValue: listingRepo },
        { provide: getRepositoryToken(StellarNft), useValue: nftRepo },
        { provide: ConfigService, useValue: configService },
        { provide: MarketplaceSettlementClient, useValue: settlementClient },
        { provide: TransactionService, useValue: transactionService },
      ],
    }).compile();

    service = module.get<ListingService>(ListingService);
  });

  it('creates listing in legacy DB mode', async () => {
    const dto: CreateListingDto = {
      nftContractId: 'C1',
      nftTokenId: '1',
      price: 15,
      currency: 'XLM',
    };
    const listing = {
      ...dto,
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
    };

    listingRepo.findOne.mockResolvedValue(null);
    nftRepo.findOne.mockResolvedValue({ contractId: 'C1', tokenId: '1' });
    listingRepo.create.mockReturnValue(listing);
    listingRepo.save.mockResolvedValue(listing);

    const result = await service.create(dto, 'seller-1');

    expect(result).toEqual(listing);
    expect(listingRepo.findOne).toHaveBeenCalled();
    expect(nftRepo.findOne).toHaveBeenCalled();
    expect(listingRepo.create).toHaveBeenCalled();
    expect(listingRepo.save).toHaveBeenCalledWith(listing);
  });

  it('creates listing in onchain mode', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'ENABLE_ONCHAIN_SETTLEMENT' ? true : undefined,
    );

    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    const dto: CreateListingDto = {
      nftContractId: 'C2',
      nftTokenId: '2',
      price: 25,
      currency: 'USDC',
      expiresAt,
    };

    listingRepo.create.mockImplementation(
      (payload: Partial<Listing>) => payload,
    );

    const result = await service.create(dto, 'seller-2');

    expect(settlementClient.createSale).toHaveBeenCalledTimes(1);
    expect(settlementClient.createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        seller: 'seller-2',
        nftContract: 'C2',
        tokenId: '2',
        price: '25',
        currency: 'USDC',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        nftContractId: 'C2',
        nftTokenId: '2',
        sellerId: 'seller-2',
      }),
    );
    expect(listingRepo.save).not.toHaveBeenCalled();
  });

  it('creates listing in onchain mode with defaults', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'ENABLE_ONCHAIN_SETTLEMENT' ? true : undefined,
    );

    const dto: CreateListingDto = {
      nftContractId: 'C3',
      nftTokenId: '3',
      price: 30,
    };

    listingRepo.create.mockImplementation(
      (payload: Partial<Listing>) => payload,
    );

    const result = await service.create(dto, 'seller-3');

    expect(settlementClient.createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'XLM',
        durationSeconds: 0,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        currency: 'XLM',
      }),
    );
  });

  it('rejects non-positive price', async () => {
    await expect(
      service.create(
        { nftContractId: 'C1', nftTokenId: '1', price: 0 } as CreateListingDto,
        'seller-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate active listing', async () => {
    listingRepo.findOne.mockResolvedValue({ id: 'listing-1' });

    await expect(
      service.create(
        { nftContractId: 'C1', nftTokenId: '1', price: 10 } as CreateListingDto,
        'seller-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects create when nft does not exist', async () => {
    listingRepo.findOne.mockResolvedValue(null);
    nftRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        { nftContractId: 'C1', nftTokenId: '1', price: 10 } as CreateListingDto,
        'seller-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll applies filters and pagination', async () => {
    const qb = makeQb();
    qb.getMany.mockResolvedValue([{ id: 'listing-1' }]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll({
      status: ListingStatus.ACTIVE,
      sellerId: 'seller-1',
      nftContractId: 'C1',
      nftTokenId: '1',
      page: 2,
      limit: 5,
    });

    expect(result).toEqual([{ id: 'listing-1' }]);
    expect(qb.andWhere).toHaveBeenCalled();
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it('findAll applies active guard by default when status is not provided', async () => {
    const qb = makeQb();
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll();

    expect(qb.andWhere).toHaveBeenCalledWith(
      'l.expiresAt IS NULL OR l.expiresAt > :now',
      expect.any(Object),
    );
  });

  it('findConnection returns page data and hasNextPage', async () => {
    const mainQb = makeQb();
    const totalQb = makeQb();
    mainQb.getMany.mockResolvedValue([{ id: '3' }, { id: '2' }, { id: '1' }]);
    totalQb.getCount.mockResolvedValue(7);

    listingRepo.createQueryBuilder
      .mockReturnValueOnce(mainQb)
      .mockReturnValueOnce(totalQb);

    const result = await service.findConnection({
      first: 2,
      status: ListingStatus.ACTIVE,
      sellerId: 'seller-1',
    });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(7);
    expect(result.hasNextPage).toBe(true);
  });

  it('findConnection handles cursor and hasNextPage false', async () => {
    const mainQb = makeQb();
    const totalQb = makeQb();
    mainQb.getMany.mockResolvedValue([{ id: '3' }]);
    totalQb.getCount.mockResolvedValue(1);

    listingRepo.createQueryBuilder
      .mockReturnValueOnce(mainQb)
      .mockReturnValueOnce(totalQb);

    const result = await service.findConnection({
      first: 2,
      after: { createdAt: new Date().toISOString(), id: '9' },
      nftContractId: 'C1',
      nftTokenId: '1',
    });

    expect(result.total).toBe(1);
    expect(result.hasNextPage).toBe(false);
    expect(mainQb.andWhere).toHaveBeenCalled();
  });

  it('findOne returns listing when found', async () => {
    listingRepo.findOne.mockResolvedValue({ id: 'listing-1' });

    const result = await service.findOne('listing-1');

    expect(result).toEqual({ id: 'listing-1' });
  });

  it('findOne throws 404 when listing is missing', async () => {
    listingRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findByNft returns matching listings', async () => {
    listingRepo.find.mockResolvedValue([{ id: 'listing-1' }]);

    const result = await service.findByNft('C1', '1');

    expect(result).toEqual([{ id: 'listing-1' }]);
    expect(listingRepo.find).toHaveBeenCalledWith({
      where: { nftContractId: 'C1', nftTokenId: '1' },
    });
  });

  it('findByNFTIds returns empty array when ids are invalid', async () => {
    const result = await service.findByNFTIds(['', 'invalid']);
    expect(result).toEqual([]);
  });

  it('findByNFTIds returns empty array when ids list is empty', async () => {
    const result = await service.findByNFTIds([]);
    expect(result).toEqual([]);
  });

  it('findByNFTIds queries active non-expired listings', async () => {
    const qb = makeQb();
    qb.getMany.mockResolvedValue([{ id: 'listing-1' }]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findByNFTIds(['C1:1', 'C2:2', 'C1:1']);

    expect(result).toEqual([{ id: 'listing-1' }]);
    expect(qb.andWhere).toHaveBeenCalledWith('l.status = :status', {
      status: ListingStatus.ACTIVE,
    });
  });

  it('cancel throws 403 when non-seller attempts cancellation', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
    });

    await expect(
      service.cancel('listing-1', 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancel throws 400 when listing is not active', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.CANCELLED,
    });

    await expect(
      service.cancel('listing-1', 'seller-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancel updates status to cancelled for seller', async () => {
    const listing = {
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
    } as Listing;
    listingRepo.findOne.mockResolvedValue(listing);
    listingRepo.save.mockResolvedValue({
      ...listing,
      status: ListingStatus.CANCELLED,
    });

    const result = await service.cancel('listing-1', 'seller-1');

    expect(result.status).toBe(ListingStatus.CANCELLED);
    expect(listingRepo.save).toHaveBeenCalled();
  });

  it('buy throws 400 when listing is not active', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.CANCELLED,
    });

    await expect(service.buy('listing-1', 'buyer-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('buy throws 400 when listing has expired', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.buy('listing-1', 'buyer-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('buy executes transaction and returns completed payload', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    transactionService.createAndExecuteListingPurchase.mockResolvedValue({
      id: 99,
      state: TransactionState.COMPLETED,
    });

    const result = await service.buy('listing-1', 'buyer-1');

    expect(result).toEqual({
      success: true,
      listingId: 'listing-1',
      buyer: 'buyer-1',
      transactionId: 99,
      transactionState: TransactionState.COMPLETED,
    });
  });

  it('buy returns unsuccessful payload for non-completed transaction state', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
    });
    transactionService.createAndExecuteListingPurchase.mockResolvedValue({
      id: 100,
      state: TransactionState.PENDING,
    });

    const result = await service.buy('listing-1', 'buyer-1');

    expect(result.success).toBe(false);
    expect(result.transactionState).toBe(TransactionState.PENDING);
  });

  it('buy bubbles conflict errors from transaction flow (409 path)', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
    });
    transactionService.createAndExecuteListingPurchase.mockRejectedValue(
      new ConflictException('Already finalized'),
    );

    await expect(service.buy('listing-1', 'buyer-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('buy bubbles unauthorized errors from transaction flow (401 path)', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
    });
    transactionService.createAndExecuteListingPurchase.mockRejectedValue(
      new UnauthorizedException('Signature missing'),
    );

    await expect(service.buy('listing-1', 'buyer-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('expireListings marks active expired listings', async () => {
    const qb = makeQb();
    qb.getMany.mockResolvedValue([
      { id: 'l1', status: ListingStatus.ACTIVE },
      { id: 'l2', status: ListingStatus.ACTIVE },
    ]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);
    listingRepo.save.mockResolvedValue(undefined);

    await service.expireListings();

    expect(listingRepo.save).toHaveBeenCalledTimes(2);
  });

  it('expireListings continues and logs when save fails', async () => {
    const qb = makeQb();
    qb.getMany.mockResolvedValue([{ id: 'l1', status: ListingStatus.ACTIVE }]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);
    listingRepo.save.mockRejectedValue(new Error('db failed'));
    const loggerHost = service as unknown as {
      logger: { error: (...args: unknown[]) => void };
    };
    const errorSpy = jest.spyOn(loggerHost.logger, 'error');

    await service.expireListings();

    expect(errorSpy).toHaveBeenCalled();
  });
});
