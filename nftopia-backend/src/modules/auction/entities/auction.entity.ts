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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftContractId: string;

  @Column()
  nftTokenId: string;

  @Column({ nullable: true })
  sellerId?: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'sellerId' })
  seller?: User | null;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  startPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, nullable: true })
  reservePrice?: number;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ name: 'extension_count', default: 0 })
  extensionCount: number;

  /** Override of the platform-wide minimum bid increment (#652), as a fraction of the current highest bid (e.g. 0.05 = 5%). Null falls back to the platform default. */
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  minBidIncrementPct?: number | null;

  @Column({ default: AuctionStatus.ACTIVE })
  status: AuctionStatus;

  @Column({ nullable: true })
  winnerId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
