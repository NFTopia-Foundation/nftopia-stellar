import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Listing } from './entities/listing.entity';
import { ListingStatus } from './interfaces/listing.interface';
import {
  LISTING_UNAVAILABLE_CODE,
  ListingUnavailableException,
} from './exceptions/listing-unavailable.exception';
import { ListingService } from './listing.service';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { TransactionService } from '../transaction/transaction.service';

/**
 * Regression test for the double-buy race (issue #533).
 *
 * Two buyers hit `:id/buy` for the same listing at the same time. The fake
 * `DataSource` below reproduces exactly the Postgres semantics the production
 * code depends on:
 *
 *  - `transaction()` executes its callback while holding an exclusive lock, so
 *    two concurrent claim callbacks are serialised exactly like two
 *    transactions contending for the same `SELECT ... FOR UPDATE` row;
 *  - `save()` commits the mutated row, so the second claim observes the first
 *    claimant's committed reservation.
 *
 * Because the fake is deterministic (a real mutex, not timeout ordering), the
 * assertions below cannot flake.
 */

/** Minimal async mutex - models row-level lock acquisition. */
class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.tail;
    this.tail = previous.then(() => gate);
    await previous;
    return release;
  }
}

type ListingRow = Pick<
  Listing,
  | 'id'
  | 'nftContractId'
  | 'nftTokenId'
  | 'sellerId'
  | 'price'
  | 'currency'
  | 'status'
  | 'expiresAt'
  | 'version'
  | 'reservedAt'
  | 'reservedBy'
>;

/** Shape of a successful `buy()` result. */
type BuyResult = Awaited<ReturnType<ListingService['buy']>>;

describe('ListingService purchase concurrency', () => {
  let service: ListingService;

  /** The single row of our in-memory `listings` table. */
  let row: ListingRow;
  let lock: Mutex;

  const transactionService = {
    createAndExecuteListingPurchaseWithPayment: jest.fn(
      async (): Promise<{ id: string; state: TransactionState }> => {
        // Simulate a slow Soroban round trip so both requests are provably in
        // flight simultaneously.
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { id: 'tx-1', state: TransactionState.COMPLETED };
      },
    ),
  };

  let manager: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  let dataSource: { transaction: jest.Mock };

  let listingRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    row = {
      id: 'listing-1',
      nftContractId: 'C1',
      nftTokenId: '1',
      sellerId: 'seller-1',
      price: 100,
      currency: 'XLM',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      version: 1,
      reservedAt: null,
      reservedBy: null,
    };
    lock = new Mutex();

    manager = {
      // Returns a snapshot, like a real SELECT.
      findOne: jest.fn(async () => ({ ...row })),
      // Commits the write and bumps the optimistic-lock version.
      save: jest.fn(async (_entity: unknown, value: ListingRow) => {
        Object.assign(row, value, { version: row.version + 1 });
        return { ...row };
      }),
    };

    dataSource = {
      transaction: jest.fn(
        async (work: (m: typeof manager) => Promise<unknown>) => {
          const release = await lock.acquire();
          try {
            return await work(manager);
          } finally {
            release();
          }
        },
      ),
    };

    listingRepo = {
      findOne: jest.fn(async () => ({ ...row })),
      update: jest.fn(
        async (_criteria: unknown, patch: Partial<ListingRow>) => {
          Object.assign(row, patch);
          return { affected: 1 };
        },
      ),
      save: jest.fn(async (entity: ListingRow) => entity),
      find: jest.fn(async () => []),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: getRepositoryToken(Listing), useValue: listingRepo },
        {
          provide: getRepositoryToken(StellarNft),
          useValue: { findOne: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: MarketplaceSettlementClient,
          useValue: { createSale: jest.fn(), executeSale: jest.fn() },
        },
        { provide: TransactionService, useValue: transactionService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ListingService>(ListingService);
  });

  it('lets exactly one of two simultaneous buyers win and settles on-chain once', async () => {
    const results = await Promise.allSettled([
      service.buy('listing-1', 'buyer-a'),
      service.buy('listing-1', 'buyer-b'),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<BuyResult> =>
        result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected',
    );

    // Exactly one success, exactly one clear, specific rejection.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(fulfilled[0].value.success).toBe(true);

    const loser = rejected[0].reason as ListingUnavailableException;
    expect(loser).toBeInstanceOf(ListingUnavailableException);
    expect(loser.code).toBe(LISTING_UNAVAILABLE_CODE);
    expect(loser.getStatus()).toBe(409);
    expect(loser.listingId).toBe('listing-1');

    // No duplicate on-chain settlement for a single listing.
    expect(
      transactionService.createAndExecuteListingPurchaseWithPayment,
    ).toHaveBeenCalledTimes(1);

    // Final state: sold once, reservation cleared.
    expect(row.status).toBe(ListingStatus.SOLD);
    expect(row.reservedAt).toBeNull();
    expect(row.reservedBy).toBeNull();
  });

  it('serialises the claim so the loser never starts a settlement', async () => {
    // Make settlement hang until we release it, guaranteeing that the loser's
    // claim is attempted while the winner is still settling.
    let finishSettlement!: () => void;
    const settlementGate = new Promise<void>((resolve) => {
      finishSettlement = resolve;
    });
    transactionService.createAndExecuteListingPurchaseWithPayment.mockImplementationOnce(
      async () => {
        await settlementGate;
        return { id: 'tx-slow', state: TransactionState.COMPLETED };
      },
    );

    const winner = service.buy('listing-1', 'buyer-a');
    // Let the winner take the reservation, then fire the second request.
    await new Promise((resolve) => setImmediate(resolve));
    const loserResult: unknown = await service
      .buy('listing-1', 'buyer-b')
      .catch((e: unknown) => e);

    expect(loserResult).toBeInstanceOf(ListingUnavailableException);
    expect(row.reservedBy).toBe('buyer-a');

    finishSettlement();
    const winnerResult = await winner;
    expect(winnerResult.success).toBe(true);
    expect(
      transactionService.createAndExecuteListingPurchaseWithPayment,
    ).toHaveBeenCalledTimes(1);
  });

  it('releases the reservation when the winning settlement fails, so the listing is buyable again', async () => {
    transactionService.createAndExecuteListingPurchaseWithPayment.mockRejectedValueOnce(
      new Error('soroban unavailable'),
    );

    await expect(service.buy('listing-1', 'buyer-a')).rejects.toThrow(
      'soroban unavailable',
    );

    expect(row.reservedAt).toBeNull();
    expect(row.status).toBe(ListingStatus.ACTIVE);

    transactionService.createAndExecuteListingPurchaseWithPayment.mockResolvedValueOnce(
      { id: 'tx-2', state: TransactionState.COMPLETED },
    );

    const result = await service.buy('listing-1', 'buyer-b');

    expect(result.success).toBe(true);
    expect(row.status).toBe(ListingStatus.SOLD);
  });
});
