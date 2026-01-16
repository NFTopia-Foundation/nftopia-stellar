import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NFT } from '../../nfts/entities/nft.entity';
import { Bid } from '../../bids/entities/bid.entity';

@Entity({ schema: 'nftopia_marketplace_service' })
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.auctions)
  seller: User;

  @ManyToOne(() => NFT)
  nft: NFT;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({ default: 'live' })
  status: 'live' | 'ended' | 'cancelled';

  @OneToMany(() => Bid, (bid) => bid.auction)
  bids: Bid[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
