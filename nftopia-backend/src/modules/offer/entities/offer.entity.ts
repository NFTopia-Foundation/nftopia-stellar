import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('offers')
@Index(['nftContractId', 'nftTokenId'])
@Index(['bidderId'])
@Index(['ownerId'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bidderId: string; // Stellar public key

  @Column()
  ownerId: string; // Stellar public key

  @Column()
  nftContractId: string;

  @Column()
  nftTokenId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amount: number;

  @Column({ default: 'XLM' })
  currency: string; // XLM, wETH, etc.

  @Column()
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.PENDING,
  })
  status: OfferStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
