import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NFT } from '../../nfts/entities/nft.entity';
import { Auction } from '../../auctions/entities/auction.entity';

@Entity({ schema: 'nftopia_payment_service' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.purchases, { eager: true })
  buyer: User;

  @ManyToOne(() => User, (user) => user.sales, { eager: true })
  seller: User;

  @ManyToOne(() => NFT)
  nft: NFT;

  @ManyToOne(() => Auction)
  auction: Auction;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: number;

  @Column()
  transactionHash: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'completed' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
