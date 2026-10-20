import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../users/user.entity';
import { AuctionStatus } from '../interfaces/auction.interface';

@Entity('auctions')
export class Auction {
  @PrimaryGeneratedColumn('.uuid')
  id: string;

  @Column()
  nftContractId: string;

  @Column()
  nftTokenId: string;

  @Column({ nullable: true })
  sellerId?: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ type: 'sellerId' })
  seller?: User | null;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  startPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, nullable: true })
  reservePrice?: number;

  /**
   * Minimum increment required for a new bid to exceed the current
   * highest bid. When null, the platform-wide default is applied.
   */
  @Column({ type: 'decimal', precision: 20, scale: 7, nullable: true })
  minBidIncrement?: number | null;

  /**
   * Optional percentage-based minimum increment (e.g. 0.05 for 5%).
   * When set, it takes precedence over the fixed minBidIncrement.
   */
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  minBidIncrementPercent?: number | null;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ name: 'extension_count', default: 0 })
  extensionCount: number;

  @Column({ default: AuctionStatus.ACTIVE })
  status: AuctionStatus;

  @Column({ nullable: true })
  winnerId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
