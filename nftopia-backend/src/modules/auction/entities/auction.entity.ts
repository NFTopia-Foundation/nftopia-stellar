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

  @Column()
  sellerId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

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

  @Column({ default: AuctionStatus.ACTIVE })
  status: AuctionStatus;

  @Column({ nullable: true })
  winnerId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
