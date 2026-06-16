import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
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
  bio?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true })
  bannerUrl?: string;

  @Column({
    name: 'twitter_handle',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  twitterHandle?: string;

  @Column({
    name: 'instagram_handle',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  instagramHandle?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ name: 'is_banned', type: 'boolean', default: false })
  isBanned: boolean;

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

  @Column({ name: 'two_factor_secret', type: 'text', nullable: true })
  twoFactorSecret?: string | null;

  @Column({ name: 'is_two_factor_enabled', type: 'boolean', default: false })
  isTwoFactorEnabled: boolean;

  /** SHA-256 hashed backup codes stored as JSON array */
  @Column({
    name: 'two_factor_backup_codes',
    type: 'simple-json',
    nullable: true,
  })
  twoFactorBackupCodes?: string[] | null;

  @Column({ name: 'two_factor_enabled_at', type: 'timestamp', nullable: true })
  twoFactorEnabledAt?: Date | null;

  @Column({ name: 'two_factor_disabled_at', type: 'timestamp', nullable: true })
  twoFactorDisabledAt?: Date | null;

  @OneToMany(() => UserWallet, (wallet) => wallet.user)
  wallets?: UserWallet[];
}
