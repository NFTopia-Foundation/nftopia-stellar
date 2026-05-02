import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../users/user.entity';
import { Nft } from '../../nft/entities/nft.entity';
import { TransactionState } from '../enums/transaction-state.enum';

@Entity('transactions')
@Index('idx_transactions_buyer_id', ['buyerId'])
@Index('idx_transactions_seller_id', ['sellerId'])
@Index('idx_transactions_contract_tx_id', ['contractTxId'], { unique: true })
@Index('idx_transactions_nft_contract_token', ['nftContractId', 'nftTokenId'])
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', unique: true })
  contractTxId: string;

  @Column({ type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column({ type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'uuid', nullable: true })
  nftId?: string;

  @ManyToOne(() => Nft, { eager: true, nullable: true })
  @JoinColumn({ name: 'nftId' })
  nft?: Nft;

  @Column({ type: 'varchar', length: 56 })
  nftContractId: string;

  @Column({ type: 'varchar', length: 128 })
  nftTokenId: string;

  @Column('decimal', { precision: 20, scale: 7 })
  amount: string;

  @Column({ type: 'varchar', length: 12, default: 'XLM' })
  currency: string;

  @Column({
    type: 'enum',
    enum: TransactionState,
    default: TransactionState.DRAFT,
  })
  state: TransactionState;

  @Column({ nullable: true })
  contractState?: string;

  @Column({ type: 'bigint', nullable: true })
  totalGasUsed?: string;

  @Column({ type: 'bigint', nullable: true })
  totalCost?: string;

  @Column({ type: 'jsonb', nullable: true })
  operationResults?: Record<string, unknown>;

  @Column({ nullable: true })
  errorReason?: string;

  @Column({ type: 'bigint' })
  createdAt: number;

  @Column({ type: 'bigint', nullable: true })
  executedAt?: number;

  @Column({ type: 'bigint', nullable: true })
  completedAt?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  ipfsMetadataUri?: string;
}
