import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DlqStatus {
  PENDING = 'pending',
  RETRYING = 'retrying',
  EXHAUSTED = 'exhausted',
  RESOLVED = 'resolved',
}

@Entity('contract_event_dlq')
export class ContractEventDlq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  contractId: string;

  @Column({ nullable: true })
  ledger: number;

  @Column({ nullable: true })
  txHash: string;

  @Column({ nullable: true })
  eventIndex: number;

  @Column({ nullable: true })
  eventType: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown>;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ nullable: true, type: 'text' })
  stack: string;

  @Column({ default: 1 })
  attemptCount: number;

  @CreateDateColumn()
  firstFailedAt: Date;

  @UpdateDateColumn()
  lastFailedAt: Date;

  @Column({ nullable: true })
  nextRetryAt: Date;

  @Column({ type: 'varchar', default: DlqStatus.PENDING })
  status: DlqStatus;
}
