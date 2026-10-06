import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ContentFlagEntityType = 'listing' | 'nft' | 'collection';
export const CONTENT_FLAG_ENTITY_TYPES: readonly ContentFlagEntityType[] = [
  'listing',
  'nft',
  'collection',
];

export type ContentFlagSeverity = 'low' | 'medium' | 'high' | 'critical';
export const CONTENT_FLAG_SEVERITIES: readonly ContentFlagSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];

export type ContentFlagStatus = 'pending' | 'reviewed' | 'dismissed';

/** Only the moderation agent writes flags today — kept as a value (not an enum) for future actors. */
export const AI_AGENT_RAISED_BY = 'ai-agent';

/**
 * Sentinel `adminId` used to attribute audit-log entries for flags the AI
 * agent creates, since there's no human admin session in that request path.
 * The nil UUID is a conventional "system actor" placeholder.
 */
export const AI_AGENT_SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

/** A moderation finding raised against a listing/NFT/collection, pending human review. */
@Entity('content_flags')
@Index(['status', 'createdAt'])
@Index(['entityType', 'entityId'])
export class ContentFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: ContentFlagEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 20 })
  severity: ContentFlagSeverity;

  /** Model confidence in [0, 1]. */
  @Column({ type: 'real' })
  confidence: number;

  @Column({
    name: 'raised_by',
    type: 'varchar',
    length: 50,
    default: AI_AGENT_RAISED_BY,
  })
  raisedBy: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ContentFlagStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  /** Optional moderator rationale captured when the flag is resolved. */
  @Column({ name: 'resolution_reason', type: 'text', nullable: true })
  resolutionReason?: string;
}
