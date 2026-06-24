import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditAction {
  BAN_USER = 'BAN_USER',
  UNBAN_USER = 'UNBAN_USER',
  HIDE_COLLECTION = 'HIDE_COLLECTION',
  VERIFY_COLLECTION = 'VERIFY_COLLECTION',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admin_id', type: 'uuid' })
  adminId: string;

  @Column({ name: 'action', type: 'varchar', length: 50 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: true })
  entityType?: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string;

  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState?: Record<string, unknown>;

  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState?: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}