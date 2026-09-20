import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmailType {
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'password_reset',
  BID_NOTIFICATION = 'bid_notification',
  AUCTION_WON = 'auction_won',
  ACCOUNT_DELETION = 'account_deletion',
}

export enum EmailStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

/**
 * Delivery-status record for every transactional email the platform sends.
 * Written when a send is enqueued and updated by the EmailProcessor once
 * the provider responds (or exhausts its retry attempts).
 */
@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  to: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'enum', enum: EmailType })
  type: EmailType;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.QUEUED })
  status: EmailStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider?: string | null;

  @Column({ name: 'message_id', type: 'varchar', length: 255, nullable: true })
  messageId?: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
