import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 56, unique: true, nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email?: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash?: string | null;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  username?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true })
  bannerUrl?: string | null;

  @Column({
    name: 'twitter_handle',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  twitterHandle?: string | null;

  @Column({
    name: 'instagram_handle',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  instagramHandle?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website?: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ name: 'is_banned', type: 'boolean', default: false })
  isBanned: boolean;

  /**
   * Set when a GDPR right-to-erasure request has been executed. The row is
   * kept (and anonymized) so on-chain / marketplace records that reference
   * the user id remain resolvable.
   */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'is_anonymized', type: 'boolean', default: false })
  isAnonymized: boolean;

  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 56,
    nullable: true,
    unique: true,
  })
  walletAddress?: string | null;

  @Column({
    name: 'wallet_public_key',
    type: 'varchar',
    length: 56,
    nullable: true,
  })
  walletPublicKey?: string | null;

  @Column({
    name: 'wallet_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  walletProvider?: string | null;

  @Column({ name: 'wallet_connected_at', type: 'timestamp', nullable: true })
  walletConnectedAt?: Date | null;

  // 2FA Fields
  @Column({
    name: 'two_factor_secret',
    type: 'text',
    nullable: true,
  })
  twoFactorSecret?: string | null;

  @Column({
    name: 'is_two_factor_enabled',
    type: 'boolean',
    default: false,
  })
  twoFactorEnabled: boolean;

  @Column({
    name: 'two_factor_backup_codes',
    type: 'text',
    array: true,
    nullable: true,
    default: [],
  })
  twoFactorBackupCodes?: string[] | null;

  @Column({
    name: 'two_factor_enabled_at',
    type: 'timestamp',
    nullable: true,
  })
  twoFactorEnabledAt?: Date | null;

  @Column({
    name: 'two_factor_disabled_at',
    type: 'timestamp',
    nullable: true,
  })
  twoFactorDisabledAt?: Date | null;

  @OneToMany(() => UserWallet, (wallet) => wallet.user)
  wallets?: UserWallet[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
