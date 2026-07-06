import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../users/user.entity';

export enum ActivityType {
  NFT_MINTED = 'NFT_MINTED',
  NFT_PURCHASED = 'NFT_PURCHASED',
  NFT_SOLD = 'NFT_SOLD',
  AUCTION_CREATED = 'AUCTION_CREATED',
  AUCTION_WON = 'AUCTION_WON',
  BID_PLACED = 'BID_PLACED',
  COLLECTION_CREATED = 'COLLECTION_CREATED',
  COLLECTION_FOLLOWED = 'COLLECTION_FOLLOWED',
  USER_FOLLOWED = 'USER_FOLLOWED',
  AUCTION_SETTLED = 'AUCTION_SETTLED',
}

@Entity('activities')
@Index(['actorId', 'createdAt'])
@Index(['targetId', 'activityType'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  actorId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column({ type: 'uuid', nullable: true })
  targetId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  collectionId?: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  nftId?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actorId' })
  actor: User;

  @CreateDateColumn()
  createdAt: Date;
}
