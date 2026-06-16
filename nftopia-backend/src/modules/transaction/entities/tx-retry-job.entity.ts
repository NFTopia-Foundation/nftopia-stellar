import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TxRetryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  DEAD = 'DEAD',
}

@Entity('tx_retry_jobs')
@Index('idx_tx_retry_jobs_transaction_id', ['transactionId'])
@Index('idx_tx_retry_jobs_status_next_retry', ['status', 'nextRetryAt'])
export class TxRetryJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  transactionId: number;

  @Column({ type: 'enum', enum: TxRetryStatus, default: TxRetryStatus.PENDING })
  status: TxRetryStatus;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'int', default: 5 })
  maxAttempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
