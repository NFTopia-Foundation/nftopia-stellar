// src/categories/category.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NFT } from '../../nfts/entities/nft.entity'; // Assuming you have an NFT entity
import { Exclude } from 'class-transformer';

@Entity({ schema: 'nftopia_user_service' })
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => NFT, (nft) => nft.category) // Assuming each NFT belongs to a category
  @Exclude() // You can exclude the NFTs field when transforming category
  nfts: NFT[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
