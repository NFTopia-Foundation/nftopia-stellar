import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PrimaryStorage } from '../storage.types';

@Entity('stored_assets')
@Index('idx_stored_assets_file_hash', ['fileHash'], { unique: true })
@Index('idx_stored_assets_primary_storage', ['primaryStorage'])
@Index('idx_stored_assets_uploaded_by', ['uploadedBy'])
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
