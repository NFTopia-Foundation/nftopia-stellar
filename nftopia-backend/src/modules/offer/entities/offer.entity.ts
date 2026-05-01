import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../../users/user.entity';
import { OfferStatus } from '../interfaces/offer.interface';

@Entity('offers')
@Index(['nftContractId', 'nftTokenId', 'status'])
@Index(['bidderId', 'status'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftContractId: string;

  @Column()
  nftTokenId: string;

  /** User who made the offer */
  @Column()
  bidderId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  /** Current owner of the NFT at the time of offer creation */
  @Column()
  ownerId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amount: number;

  @Column({ default: 'XLM' })
  currency: string;

  @Column()
  expiresAt: Date;

  @Column({ default: OfferStatus.PENDING })
  status: OfferStatus;

  /** On-chain transaction hash generated after acceptance */
  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
