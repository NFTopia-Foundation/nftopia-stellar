import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('auctions')
@Index(['nftContractId', 'tokenId'])
@Index(['seller'])
@Index(['endTime'])
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftContractId: string;

  @Column()
  tokenId: string;

  @Column()
  seller: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  startPrice: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  reservePrice: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: '0.1000000' })
  minBidIncrement: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  currentHighBid: string;

  @Column({ nullable: true })
  currentHighBidder: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @Column({ default: false })
  isSettled: boolean;

  @Column({ default: false })
  reserveMet: boolean;

  @Column({ default: false })
  winnerClaimable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
