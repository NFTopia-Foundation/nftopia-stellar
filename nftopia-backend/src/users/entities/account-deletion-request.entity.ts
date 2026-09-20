import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeletionRequestStatus } from '../gdpr.constants';

/**
 * A user's request to exercise their right to erasure.
 *
 * The request starts in {@link DeletionRequestStatus.PENDING_VERIFICATION}
 * and only becomes {@link DeletionRequestStatus.SCHEDULED} after the user
 * proves control of their email address. A scheduled request is executed by
 * the {@link AccountDeletionScheduler} once the grace period elapses, unless
 * the user cancels it first.
 */
@Entity('account_deletion_requests')
export class AccountDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_account_deletion_requests_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: DeletionRequestStatus.PENDING_VERIFICATION,
  })
  status: DeletionRequestStatus;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({
    name: 'verification_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  verificationTokenHash?: string | null;

  @Column({
    name: 'verification_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  verificationExpiresAt?: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt?: Date | null;

  @Column({ name: 'scheduled_for', type: 'timestamptz', nullable: true })
  scheduledFor?: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
