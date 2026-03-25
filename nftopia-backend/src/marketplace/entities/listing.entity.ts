import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('listings')
@Index(['status'])
@Index(['nftId'])
@Index(['sellerId'])
@Index(['createdAt'])
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftId: string;

  @Column()
  sellerId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  price: string;

  @Column({ default: 'XLM' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.ACTIVE,
  })
  status: ListingStatus;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
