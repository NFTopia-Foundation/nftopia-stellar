import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('user_follows')
@Unique('uq_user_follows_pair', ['followerId', 'followingId'])
export class UserFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_user_follows_follower_id')
  @Column({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @Index('idx_user_follows_following_id')
  @Column({ name: 'following_id', type: 'uuid' })
  followingId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
