import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('listings')
/**
 * `status` + `reservedAt` are the columns the purchase path uses to serialise
 * concurrent buyers, so they get a composite index for the claim/expiry scans.
 */
@Index('idx_listings_status_reservation', ['status', 'reservedAt'])
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftContractId: string;

  @Column()
  nftTokenId: string;

  @Column()
  sellerId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  price: number;

  @Column({ default: 'XLM' })
  currency: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ nullable: true })
  expiresAt?: Date;

  /**
   * Optimistic-locking counter, incremented by TypeORM on every `save()`.
   * A save built from a stale read fails with
   * `OptimisticLockVersionMismatchError` instead of silently clobbering a
   * concurrent writer (e.g. cancel racing a purchase).
   */
  @VersionColumn()
  version: number;

  /**
   * Set while a single buyer holds the listing during settlement (see
   * `ListingService.claimListing`). While non-null the listing is no longer
   * purchasable by anyone else. `status` deliberately stays `ACTIVE` because
   * downstream settlement only accepts ACTIVE listings.
   *
   * Cleared on settlement success/failure, or by the stale-reservation sweeper
   * in `expireListings()` for reservations whose owner crashed mid-flight.
   */
  @Column({ nullable: true })
  reservedAt?: Date | null;

  /** Buyer that currently holds the reservation. Diagnostic/audit only. */
  @Column({ nullable: true })
  reservedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
