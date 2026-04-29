import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Auction } from './auction.entity';
import { User } from '../../../users/user.entity';

export enum BidSorobanStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

@Entity('bids')
@Index(['auctionId', 'createdAt'])
@Index(['auctionId', 'amount'])
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  auctionId: string;

  @ManyToOne(() => Auction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auctionId' })
  auction: Auction;

  @Column()
  bidderId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amount: number;

  /** Human-readable XLM amount (derived from amount in stroops) */
  @Column({ type: 'varchar', length: 30, nullable: true })
  amountXlm?: string;

  /** Soroban transaction hash from on-chain bid submission */
  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash?: string;

  /** Ledger sequence number where the bid was confirmed */
  @Column({ type: 'int', nullable: true })
  ledgerSequence?: number;

  /** Bidder's Stellar public key used for signature verification */
  @Column({ type: 'varchar', length: 56, nullable: true })
  stellarPublicKey?: string;

  /** On-chain submission status */
  @Column({
    type: 'varchar',
    length: 20,
    default: BidSorobanStatus.SKIPPED,
  })
  sorobanStatus: BidSorobanStatus;

  @CreateDateColumn()
  createdAt: Date;
}
