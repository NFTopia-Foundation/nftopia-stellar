import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Collection } from '../../collections/entities/collection.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity({ schema: 'nftopia_user_service' })
export class NFT {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tokenId: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  imageUrl: string; 

  @Column({ nullable: true })
  ipfsUrl: string; 

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  price: number;

  @Column({ default: 'STK' })
  currency: string;

  @ManyToOne(() => User, user => user.nfts)
  owner: User;

  @ManyToOne(() => Collection, collection => collection.nfts)
  collection: Collection;

  @ManyToOne(() => Category, (category) => category.nfts, { nullable: false })
  category: Category;

  @Column({ default: false })
  isListed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
