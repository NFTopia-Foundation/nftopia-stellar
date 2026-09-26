import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateListingDto } from './dto/create-listing.dto';
import { BuyNftDto } from './dto/buy-nft.dto';
import { Listing } from './entities/listing.entity';
import { ListingStatus } from './interfaces/listing.interface';
import { ListingService } from './listing.service';
import {
  LISTING_UNAVAILABLE_CODE,
  ListingUnavailableException,
  ListingUnavailableReason,
} from './exceptions/listing-unavailable.exception';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { TransactionService } from '../transaction/transaction.service';
import { PaymentMethod } from '../payment/enums/payment-method.enum';

type MockQb = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  select: jest.Mock;
  getMany: jest.Mock;
  getCount: jest.Mock;
  getRawMany: jest.Mock;
  leftJoinAndSelect: jest.Mock;
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
  qb.select = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  return qb as MockQb;
};

describe('ListingService', () => {
  let service: ListingService;

  const listingRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  };

  const nftRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  /**
   * The claim transaction reads the row through the same repository mock each
   * test stubs (`findOne`), so the whole spec file sees one shared "table row".
   * The single-threaded unit tests here cannot exercise real lock contention;
   * `listing.purchase-concurrency.spec.ts` covers serialisation explicitly.
   */
  const manager = {
    findOne: jest.fn(
      (..._args: unknown[]): Promise<Listing | null> =>
        listingRepo.findOne() as Promise<Listing | null>,
    ),
    save: jest.fn(
      (_entity: unknown, entity: Listing): Promise<Listing> =>
        Promise.resolve(entity),
    ),
  };

  const dataSource = {
    transaction: jest.fn(
      (work: (m: typeof manager) => unknown): unknown => work(manager),
    ),
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
    createAndExecuteListingPurchaseWithPayment: jest.fn(),
    createOffchainPaymentTransaction: jest.fn(),
    createAndExecuteBundlePurchase: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
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
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ListingService>(ListingService);
  });

  /** setImmediate-queued work (the emitListingCreated call) runs after this resolves. */
  const flushSetImmediate = () =>
    new Promise((resolve) => setImmediate(resolve));

  it('creates listing in legacy DB mode', async () => {
    const dto: CreateListingDto = {
      nftContractId: 'C1',
      nftTokenId: '1',
      price: 15,
      currency: 'XLM',
    };
    const listing = {
      id: 'listing-1',
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

  it('emits listing.created off the critical path in legacy DB mode', async () => {
    const dto: CreateListingDto = {
      nftContractId: 'C1',
      nftTokenId: '1',
      price: 15,
      currency: 'XLM',
    };
    const listing = {
      id: 'listing-1',
      ...dto,
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
    };

    listingRepo.findOne.mockResolvedValue(null);
    nftRepo.findOne.mockResolvedValue({ contractId: 'C1', tokenId: '1' });
    listingRepo.create.mockReturnValue(listing);
    listingRepo.save.mockResolvedValue(listing);

    const result = await service.create(dto, 'seller-1');

    // Not emitted yet: emission is deferred to a setImmediate, off the
    // request's critical path, so it must not have fired synchronously.
    expect(result).toEqual(listing);
    expect(eventEmitter.emit).not.toHaveBeenCalled();

    await flushSetImmediate();

    expect(eventEmitter.emit).toHaveBeenCalledWith('listing.created', {
      listingId: 'listing-1',
      sellerId: 'seller-1',
      nftContractId: 'C1',
      nftTokenId: '1',
    });
  });

  it('emits listing.created with the on-chain sale id in onchain mode', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'ENABLE_ONCHAIN_SETTLEMENT' ? true : undefined,
    );
    settlementClient.createSale.mockResolvedValue(42);

    const dto: CreateListingDto = {
      nftContractId: 'C2',
      nftTokenId: '2',
      price: 25,
      currency: 'USDC',
    };

    listingRepo.create.mockImplementation(
      (payload: Partial<Listing>) => payload,
    );

    const result = await service.create(dto, 'seller-2');

    expect(result).toBeDefined();
    expect(eventEmitter.emit).not.toHaveBeenCalled();

    await flushSetImmediate();

    expect(eventEmitter.emit).toHaveBeenCalledWith('listing.created', {
      listingId: '42',
      sellerId: 'seller-2',
      nftContractId: 'C2',
      nftTokenId: '2',
    });
  });

  it('rejects non-positive price', async () => {
    await expect(
      service.create(
        { nftContractId: 'C1', nftTokenId: '1', price: 0 },
        'seller-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate active listing', async () => {
    listingRepo.findOne.mockResolvedValue({ id: 'listing-1' });

    await expect(
      service.create(
        { nftContractId: 'C1', nftTokenId: '1', price: 10 },
        'seller-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects create when nft does not exist', async () => {
    listingRepo.findOne.mockResolvedValue(null);
    nftRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        { nftContractId: 'C1', nftTokenId: '1', price: 10 },
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
    // Service fetches first + 1 items to determine hasNextPage
    // For first=2, it fetches 3 items
    const listings = [
      { id: 'listing-1', status: ListingStatus.ACTIVE },
      { id: 'listing-2', status: ListingStatus.ACTIVE },
      { id: 'listing-3', status: ListingStatus.ACTIVE }, // Extra item for hasNextPage
    ];
    mainQb.getMany.mockResolvedValue(listings);
    totalQb.getCount.mockResolvedValue(7);

    listingRepo.createQueryBuilder
      .mockReturnValueOnce(mainQb)
      .mockReturnValueOnce(totalQb);

    const result = await service.findConnection({
      first: 2,
      status: ListingStatus.ACTIVE,
      sellerId: 'seller-1',
    });

    // Should only return first 2 items
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(7);
    expect(result.hasNextPage).toBe(true);
    expect(mainQb.leftJoinAndSelect).toHaveBeenCalled();
  });

  it('findConnection handles cursor and hasNextPage false', async () => {
    const mainQb = makeQb();
    const totalQb = makeQb();
    // Only 1 item returned, so hasNextPage should be false
    const listings = [{ id: 'listing-1', status: ListingStatus.ACTIVE }];
    mainQb.getMany.mockResolvedValue(listings);
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

    // Should return 1 item (less than first, so hasNextPage false)
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hasNextPage).toBe(false);
    expect(mainQb.andWhere).toHaveBeenCalled();
    expect(mainQb.leftJoinAndSelect).toHaveBeenCalled();
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
    const listings = [{ id: 'listing-1' }];
    qb.getMany.mockResolvedValue(listings);
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findByNFTIds(['C1:1', 'C2:2', 'C1:1']);

    expect(result).toEqual(listings);
    expect(qb.andWhere).toHaveBeenCalledWith('l.status = :status', {
      status: ListingStatus.ACTIVE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('l.expiresAt IS NULL OR l.expiresAt > :now'),
      expect.any(Object),
    );
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
    listingRepo.findOne
      .mockResolvedValueOnce(listing)
      .mockResolvedValueOnce({ ...listing, status: ListingStatus.CANCELLED });

    const result = await service.cancel('listing-1', 'seller-1');

    expect(result.status).toBe(ListingStatus.CANCELLED);
    // Conditional update: only cancels while still ACTIVE and unreserved.
    expect(listingRepo.update).toHaveBeenCalledWith(
      {
        id: 'listing-1',
        status: ListingStatus.ACTIVE,
        reservedAt: expect.anything(),
      },
      { status: ListingStatus.CANCELLED },
    );
  });

  it('cancel refuses to cancel a listing with an in-flight purchase', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
      reservedAt: new Date(),
      reservedBy: 'buyer-1',
    });

    await expect(
      service.cancel('listing-1', 'seller-1'),
    ).rejects.toBeInstanceOf(ListingUnavailableException);
    expect(listingRepo.update).not.toHaveBeenCalled();
  });

  it('cancel loses the race when a purchase claims the listing first', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
      reservedAt: null,
    });
    // The conditional update matched no row because the reservation landed.
    listingRepo.update.mockResolvedValueOnce({ affected: 0 });

    const error = await service
      .cancel('listing-1', 'seller-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ListingUnavailableException);
    expect((error as ListingUnavailableException).code).toBe(
      LISTING_UNAVAILABLE_CODE,
    );
  });

  it('buy executes transaction and returns completed payload with default payment method', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      price: 100,
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockResolvedValue(
      {
        id: 99,
        state: TransactionState.COMPLETED,
      },
    );

    const result = await service.buy('listing-1', 'buyer-1');

    expect(result).toEqual({
      success: true,
      listingId: 'listing-1',
      buyer: 'buyer-1',
      transactionId: 99,
      transactionState: TransactionState.COMPLETED,
      paymentMethod: PaymentMethod.XLM,
      amount: 100,
    });
  });

  it('buy returns unsuccessful payload for non-completed transaction state', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      price: 100,
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockResolvedValue(
      {
        id: 100,
        state: TransactionState.PENDING,
      },
    );

    const result = await service.buy('listing-1', 'buyer-1');

    expect(result.success).toBe(false);
    expect(result.transactionState).toBe(TransactionState.PENDING);
    expect(result.amount).toBe(100);
  });

  it('buy returns unsuccessful payload for non-completed transaction state', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockResolvedValue(
      {
        id: 100,
        state: TransactionState.PENDING,
      },
    );

    const result = await service.buy('listing-1', 'buyer-1');

    expect(result.success).toBe(false);
    expect(result.transactionState).toBe(TransactionState.PENDING);
  });

  it('buy handles USDC payment with token address', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockResolvedValue(
      {
        id: 101,
        state: TransactionState.COMPLETED,
      },
    );

    const dto: BuyNftDto = {
      paymentMethod: PaymentMethod.USDC,
      tokenAddress: '0x1234567890abcdef',
    };

    const result = await service.buy('listing-1', 'buyer-1', dto);

    expect(
      transactionService.createAndExecuteListingPurchaseWithPayment,
    ).toHaveBeenCalledWith(
      'listing-1',
      'buyer-1',
      PaymentMethod.USDC,
      '0x1234567890abcdef',
      undefined,
    );
    expect(result.success).toBe(true);
  });

  it('buy handles credit card payment with stripe intent', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    transactionService.createOffchainPaymentTransaction.mockResolvedValue({
      id: 102,
      state: TransactionState.COMPLETED,
    });

    const dto: BuyNftDto = {
      paymentMethod: PaymentMethod.CREDIT_CARD,
      stripePaymentIntentId: 'pi_123456789',
    };

    const result = await service.buy('listing-1', 'buyer-1', dto);

    expect(
      transactionService.createOffchainPaymentTransaction,
    ).toHaveBeenCalledWith(
      'listing-1',
      'buyer-1',
      expect.objectContaining({
        paymentMethod: PaymentMethod.CREDIT_CARD,
        stripePaymentIntentId: 'pi_123456789',
      }),
    );
    expect(result.success).toBe(true);
  });

  it('buy handles bundle payment with bundle item ids', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      price: 100,
    });
    transactionService.createAndExecuteBundlePurchase.mockResolvedValue({
      id: 103,
      state: TransactionState.COMPLETED,
    });

    const dto: BuyNftDto = {
      paymentMethod: PaymentMethod.BUNDLE,
      bundleItemIds: ['item-1', 'item-2'],
      discountPercentage: 10,
    };

    const result = await service.buy('listing-1', 'buyer-1', dto);

    expect(
      transactionService.createAndExecuteBundlePurchase,
    ).toHaveBeenCalledWith(
      'listing-1',
      'buyer-1',
      expect.objectContaining({
        paymentMethod: PaymentMethod.BUNDLE,
        bundleItemIds: ['item-1', 'item-2'],
        discountPercentage: 10,
      }),
    );
    expect(result.success).toBe(true);
    expect(result.amount).toBe(90); // 10% discount on 100
  });

  it('buy throws error for USDC without token address', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const dto: BuyNftDto = {
      paymentMethod: PaymentMethod.USDC,
    };

    await expect(
      service.buy('listing-1', 'buyer-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('buy throws error for credit card without stripe intent', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const dto: BuyNftDto = {
      paymentMethod: PaymentMethod.CREDIT_CARD,
    };

    await expect(
      service.buy('listing-1', 'buyer-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('buy throws error for bundle without bundle item ids', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const dto: BuyNftDto = {
      paymentMethod: PaymentMethod.BUNDLE,
    };

    await expect(
      service.buy('listing-1', 'buyer-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('buy rejects with LISTING_UNAVAILABLE when the listing is not active', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.CANCELLED,
    });

    const error = await service
      .buy('listing-1', 'buyer-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ListingUnavailableException);
    const unavailable = error as ListingUnavailableException;
    expect(unavailable.code).toBe(LISTING_UNAVAILABLE_CODE);
    expect(unavailable.reason).toBe(ListingUnavailableReason.NOT_ACTIVE);
    expect(unavailable.getStatus()).toBe(409);
    // Nothing may be settled for a listing that is not purchasable.
    expect(
      transactionService.createAndExecuteListingPurchaseWithPayment,
    ).not.toHaveBeenCalled();
  });

  it('buy rejects with LISTING_UNAVAILABLE when the listing has expired', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const error = await service
      .buy('listing-1', 'buyer-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ListingUnavailableException);
    expect((error as ListingUnavailableException).reason).toBe(
      ListingUnavailableReason.EXPIRED,
    );
    expect(
      transactionService.createAndExecuteListingPurchaseWithPayment,
    ).not.toHaveBeenCalled();
  });

  it('buy rejects with LISTING_UNAVAILABLE when another buyer holds the reservation', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      reservedAt: new Date(),
      reservedBy: 'buyer-2',
    });

    const error = await service
      .buy('listing-1', 'buyer-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ListingUnavailableException);
    expect((error as ListingUnavailableException).reason).toBe(
      ListingUnavailableReason.RESERVED,
    );
    expect(
      transactionService.createAndExecuteListingPurchaseWithPayment,
    ).not.toHaveBeenCalled();
  });

  it('buy reserves the listing inside the transaction before settling', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      price: 100,
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockResolvedValue(
      { id: 99, state: TransactionState.COMPLETED },
    );

    await service.buy('listing-1', 'buyer-1');

    // Availability check + reservation write share one row-locked transaction.
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      Listing,
      expect.objectContaining({
        reservedBy: 'buyer-1',
        reservedAt: expect.any(Date),
      }),
    );
    // Winner flips the listing to SOLD and clears the reservation.
    expect(listingRepo.update).toHaveBeenCalledWith(
      { id: 'listing-1' },
      expect.objectContaining({ status: ListingStatus.SOLD }),
    );
  });

  it('buy releases the reservation when settlement fails so the listing is not stranded', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      price: 100,
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockRejectedValue(
      new ConflictException('Already finalized'),
    );

    await expect(service.buy('listing-1', 'buyer-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(listingRepo.update).toHaveBeenCalledWith(
      {
        id: 'listing-1',
        reservedBy: 'buyer-1',
        status: ListingStatus.ACTIVE,
      },
      { reservedAt: null, reservedBy: null },
    );
  });

  it('buy bubbles conflict errors from transaction flow (409 path)', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockRejectedValue(
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
      expiresAt: new Date(Date.now() + 60_000),
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockRejectedValue(
      new UnauthorizedException('Signature missing'),
    );

    await expect(service.buy('listing-1', 'buyer-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('expireListings releases stale purchase reservations', async () => {
    const qb = makeQb();
    qb.getRawMany.mockResolvedValue([{ id: 'stale-1' }, { id: 'stale-2' }]);
    qb.getMany.mockResolvedValue([]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    await service.expireListings();

    expect(qb.andWhere).toHaveBeenCalledWith('l.reservedAt IS NOT NULL');
    expect(listingRepo.update).toHaveBeenCalledWith(
      { id: expect.anything(), status: ListingStatus.ACTIVE },
      { reservedAt: null, reservedBy: null },
    );
  });

  it('expireListings skips the reservation sweep when nothing is stale', async () => {
    const qb = makeQb();
    qb.getRawMany.mockResolvedValue([]);
    qb.getMany.mockResolvedValue([]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    await service.expireListings();

    expect(listingRepo.update).not.toHaveBeenCalled();
  });

  it('expireListings logs and continues when reservation recovery throws', async () => {
    const qb = makeQb();
    qb.getRawMany.mockRejectedValue(new Error('db down'));
    qb.getMany.mockResolvedValue([]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);
    const loggerHost = service as unknown as {
      logger: { error: (...args: unknown[]) => void };
    };
    const errorSpy = jest.spyOn(loggerHost.logger, 'error');

    await service.expireListings();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('expireListings marks active expired listings', async () => {
    const qb = makeQb();
    const expiredListings = [
      { id: 'l1', status: ListingStatus.ACTIVE },
      { id: 'l2', status: ListingStatus.ACTIVE },
    ];
    qb.getMany.mockResolvedValue(expiredListings);
    listingRepo.createQueryBuilder.mockReturnValue(qb);
    listingRepo.save.mockImplementation((listing: Listing) =>
      Promise.resolve(listing),
    );

    await service.expireListings();

    expect(listingRepo.save).toHaveBeenCalledTimes(2);
    expect(listingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ListingStatus.EXPIRED }),
    );
  });

  it('expireListings continues and logs when save fails', async () => {
    const qb = makeQb();
    const expiredListings = [{ id: 'l1', status: ListingStatus.ACTIVE }];
    qb.getMany.mockResolvedValue(expiredListings);
    listingRepo.createQueryBuilder.mockReturnValue(qb);
    listingRepo.save.mockRejectedValue(new Error('db failed'));
    const loggerHost = service as unknown as {
      logger: { error: (...args: unknown[]) => void };
    };
    const errorSpy = jest.spyOn(loggerHost.logger, 'error');

    await service.expireListings();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('expireListings handles empty expired listings gracefully', async () => {
    const qb = makeQb();
    qb.getMany.mockResolvedValue([]);
    listingRepo.createQueryBuilder.mockReturnValue(qb);

    await service.expireListings();

    expect(listingRepo.save).not.toHaveBeenCalled();
  });
});
