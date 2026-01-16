import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Auction } from '../../auctions/entities/auction.entity';

@Entity({ schema: 'nftopia_marketplace_service' })
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Auction, (auction) => auction.bids, { eager: false })
  auction: Auction;

  @ManyToOne(() => User, (user) => user.bids, { eager: false })
  bidder: User;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
