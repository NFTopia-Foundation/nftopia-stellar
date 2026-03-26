import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserWallet } from '../auth/entities/user-wallet.entity';

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

  @OneToMany(() => UserWallet, (wallet) => wallet.user)
  wallets?: UserWallet[];
}
