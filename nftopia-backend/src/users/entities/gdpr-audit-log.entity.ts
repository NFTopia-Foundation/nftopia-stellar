import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GdprAuditAction } from '../gdpr.constants';

/**
 * Append-only audit trail for GDPR activity (exports and deletion attempts).
 *
 * Unlike the admin {@link AuditLog}, the actor here is the end user exercising
 * their own data rights, so `user_id` is not constrained to administrators.
 */
@Entity('gdpr_audit_logs')
export class GdprAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_gdpr_audit_logs_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index('idx_gdpr_audit_logs_action')
  @Column({ type: 'varchar', length: 50 })
  action: GdprAuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: true })
  entityType?: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
