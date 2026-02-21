import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Auction } from './auction.entity';

@Entity('bids')
@Index(['auctionId', 'ledgerSequence'])
@Index(['bidderPublicKey', 'auctionId'])
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  auctionId: string;

  @Column()
  bidderPublicKey: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amountXlm: string;

  @Column({ type: 'varchar', length: 32 })
  amountStroops: string;

  @Column()
  transactionHash: string;

  @Column({ type: 'int', default: 0 })
  ledgerSequence: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Auction, (auction) => auction.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auctionId', referencedColumnName: 'auctionId' })
  auction: Auction;
}
