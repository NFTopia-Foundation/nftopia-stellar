import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DataExportStatus } from '../gdpr.constants';
import type { ExportFormat } from '../gdpr.constants';

/**
 * Persisted state for an asynchronous GDPR data export.
 *
 * The serialized payload is stored in {@link data} once the Bull worker has
 * finished building it so the client can poll for the result without holding
 * a request thread open.
 */
@Entity('data_export_jobs')
export class DataExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_data_export_jobs_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10, default: 'json' })
  format: ExportFormat;

  @Column({
    type: 'varchar',
    length: 20,
    default: DataExportStatus.PENDING,
  })
  status: DataExportStatus;

  @Column({ type: 'text', nullable: true })
  data?: string | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
