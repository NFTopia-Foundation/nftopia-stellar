import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum NftTransferEventType {
  MINT = 'mint',
  SALE = 'sale',
  TRANSFER = 'transfer',
}

@Entity('nft_transfer_events')
@Unique(['transactionHash', 'nftContractId', 'tokenId'])
@Index(['nftContractId', 'tokenId', 'timestamp'])
export class NftTransferEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nft_contract_id', type: 'varchar', length: 56 })
  nftContractId: string;

  @Column({ name: 'token_id', type: 'varchar', length: 128 })
  tokenId: string;

  @Column({ name: 'from_address', type: 'varchar', length: 56 })
  fromAddress: string;

  @Column({ name: 'to_address', type: 'varchar', length: 56 })
  toAddress: string;

  @Column({ name: 'transaction_hash', type: 'varchar', length: 64 })
  transactionHash: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 20,
    enum: NftTransferEventType,
  })
  eventType: NftTransferEventType;

  @Column({
    name: 'price',
    type: 'decimal',
    precision: 20,
    scale: 7,
    nullable: true,
  })
  price?: string | null;

  @Column({ name: 'currency', type: 'varchar', length: 12, default: 'XLM' })
  currency: string;

  @Column({ name: 'ledger_sequence', type: 'bigint' })
  ledgerSequence: number;

  @Column({ name: 'timestamp', type: 'bigint' })
  timestamp: number;

  @Column({ name: 'memo', type: 'text', nullable: true })
  memo?: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
