import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NFT } from '../../nfts/entities/nft.entity';
import { Collection } from '../../collections/entities/collection.entity';
import { Auction } from '../../auctions/entities/auction.entity';
import { Bid } from '../../bids/entities/bid.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';



@Entity({ schema: 'nftopia_user_service' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  walletAddress: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: false })
  isArtist: boolean;

  @OneToMany(() => NFT, (nft) => nft.owner)
  nfts: NFT[];

  @OneToMany(() => Collection, (collection) => collection.creator)
  collections: Collection[];

  @OneToMany(() => Auction, (auction) => auction.seller)
  auctions: Auction[];

  @OneToMany(() => Bid, (bid) => bid.bidder)
  bids: Bid[];

  @OneToMany(() => Transaction, (tx) => tx.buyer)
  purchases: Transaction[];

  @OneToMany(() => Transaction, (tx) => tx.seller)
  sales: Transaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
