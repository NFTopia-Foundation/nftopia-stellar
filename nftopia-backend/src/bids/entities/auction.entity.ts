import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Bid } from './bid.entity';

export type AuctionStatus = 'Active' | 'Ended' | 'Cancelled';

@Entity('auctions')
@Index(['status'])
@Index(['sellerPublicKey'])
export class Auction {
  @PrimaryColumn()
  auctionId: string;

  @Column()
  sellerPublicKey: string;

  @Column()
  nftContractId: string;

  @Column()
  tokenId: string;

  @Column({ type: 'varchar', length: 20, default: 'Active' })
  status: AuctionStatus;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  reservePriceXlm: string;

  /** Minimum increment (e.g. 0.05 for 5% or fixed XLM); stored as decimal. */
  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0.05 })
  minIncrement: string;

  @Column({ type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Bid, (bid) => bid.auction)
  bids: Bid[];
}
