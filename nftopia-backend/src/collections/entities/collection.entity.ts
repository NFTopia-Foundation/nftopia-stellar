import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity'; 
import { NFT } from '../../nfts/entities/nft.entity'; 

@Entity({ schema: 'nftopia_user_service' })
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 512 })
  bannerImage: string;

  @ManyToOne(() => User, (user) => user.collections)
  creator: User;

  @OneToMany(() => NFT, (nft) => nft.collection)
  nfts: NFT[]; // Array of NFTs in this collection

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;


  @UpdateDateColumn()
  updatedAt: Date;
}