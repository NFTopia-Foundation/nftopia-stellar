import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('wallet_sessions')
@Index('idx_wallet_sessions_wallet_address', ['walletAddress'])
@Index('idx_wallet_sessions_nonce', ['nonce'])
export class WalletSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_address', type: 'varchar', length: 56 })
  walletAddress: string;

  @Column({
    name: 'wallet_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  walletProvider?: string;

  @Column({ type: 'varchar', length: 255 })
  nonce: string;

  @Column({ name: 'challenge_message', type: 'text' })
  challengeMessage: string;

  @Column({ name: 'nonce_expires_at', type: 'timestamp' })
  nonceExpiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamp', nullable: true })
  consumedAt?: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
