import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/user.entity';

@Entity('collections')
@Index('idx_collections_creator_id', ['creatorId'])
@Index('idx_collections_contract_address', ['contractAddress'], {
  unique: true,
})
@Index('idx_collections_total_volume', ['totalVolume'])
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'contract_address',
    type: 'varchar',
    length: 56,
    unique: true,
  })
  contractAddress: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  symbol: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500 })
  imageUrl: string;

  @Column({
    name: 'banner_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  bannerImageUrl?: string | null;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'total_supply', type: 'integer', default: 0 })
  totalSupply: number;

  @Column({
    name: 'floor_price',
    type: 'decimal',
    precision: 20,
    scale: 7,
    nullable: true,
  })
  floorPrice?: string | null;

  @Column({
    name: 'total_volume',
    type: 'decimal',
    precision: 20,
    scale: 7,
    default: 0,
  })
  totalVolume: string;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
