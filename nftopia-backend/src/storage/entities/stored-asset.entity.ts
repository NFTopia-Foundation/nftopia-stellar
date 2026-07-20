import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PrimaryStorage } from '../storage.types';
import type { ScanResult, ScanStatus } from '../scanning/scan.types';

@Entity('stored_assets')
@Index('idx_stored_assets_file_hash', ['fileHash'], { unique: true })
@Index('idx_stored_assets_primary_storage', ['primaryStorage'])
@Index('idx_stored_assets_uploaded_by', ['uploadedBy'])
@Index('idx_stored_assets_scan_status', ['scanStatus'])
export class StoredAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_hash', type: 'varchar', length: 64 })
  fileHash: string;

  @Column({ name: 'ipfs_cid', type: 'varchar', length: 255, nullable: true })
  ipfsCid: string | null;

  @Column({
    name: 'arweave_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  arweaveId: string | null;

  @Column({ name: 'primary_storage', type: 'varchar', length: 16 })
  primaryStorage: PrimaryStorage;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 255 })
  mimeType: string;

  @Column({ name: 'original_filename', type: 'text' })
  originalFilename: string;

  @Column({ name: 'uploaded_by', type: 'varchar', length: 255 })
  uploadedBy: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({
    name: 'scan_status',
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  scanStatus: ScanStatus;

  @Column({ name: 'scan_result', type: 'jsonb', nullable: true })
  scanResult: ScanResult | null;

  @Column({ name: 'quarantined', type: 'boolean', default: false })
  quarantined: boolean;

  @Column({ name: 'scanned_at', type: 'timestamptz', nullable: true })
  scannedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
