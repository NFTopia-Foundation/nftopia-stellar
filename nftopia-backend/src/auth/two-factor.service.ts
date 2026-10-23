import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { User } from '../users/user.entity';
import { TwoFactorConfig } from './interfaces/two-factor.interface';
import { AuthService } from './auth.service';
import { TwoFactorThrottleService } from './two-factor-throttle.service';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly config: TwoFactorConfig;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly throttleService: TwoFactorThrottleService,
  ) {
    this.config = this.loadConfig();
  }

  /**
   * Load 2FA configuration from environment
   */
  private loadConfig(): TwoFactorConfig {
    return {
      codeLength: this.configService.get<number>('TOTP_CODE_LENGTH', 6),
      window: this.configService.get<number>('TOTP_WINDOW', 1),
      timeStep: this.configService.get<number>('TOTP_TIME_STEP', 30),
      issuer: this.configService.get<string>('TOTP_ISSUER', 'NFTopia'),
      algorithm: this.configService.get<'sha1' | 'sha256' | 'sha512'>(
        'TOTP_ALGORITHM',
        'sha1',
      ),
      encoding: this.configService.get<'base32' | 'base64' | 'hex'>(
        'TOTP_ENCODING',
        'base32',
      ),
      backupCodeCount: this.configService.get<number>('BACKUP_CODE_COUNT', 10),
      backupCodeLength: this.configService.get<number>(
        'BACKUP_CODE_LENGTH',
        16,
      ),
    };
  }

  /**
   * Generate TOTP secret and QR code for enabling 2FA
   */
  async generateSecret(
    user: User,
    issuer?: string,
  ): Promise<{
    secret: string;
    qrCode: string;
    otpauthUrl: string;
    backupCodes: string[];
  }> {
    if (user.twoFactorEnabled) {
      throw new ConflictException('2FA is already enabled for this user');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: issuer || this.config.issuer,
      issuer: issuer || this.config.issuer,
    });

    // Generate OTP auth URL
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: user.email || user.walletAddress || user.id,
      issuer: issuer || this.config.issuer,
      encoding: this.config.encoding,
    });

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store secret temporarily in Redis (TTL: 5 minutes)
    const tempKey = `2fa_setup:${user.id}`;
    await this.cacheManager.set(
      tempKey,
      {
        secret: secret.base32,
        backupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
        createdAt: Date.now(),
      },
      300000, // 5 minutes
    );

    // Store the actual secret in database after verification
    // For now, we'll just keep it in Redis until verification

    this.logger.log(`2FA setup initiated for user ${user.id}`);

    return {
      secret: secret.base32,
      qrCode,
      otpauthUrl,
      backupCodes,
    };
  }

  /**
   * Verify TOTP code and enable 2FA for user
   */
  async verifyAndEnable(user: User, code: string): Promise<User> {
    await this.throttleService.assertNotLockedOut(user.id);

    if (user.twoFactorEnabled) {
      throw new ConflictException('2FA is already enabled for this user');
    }

    // Get temporary setup data from Redis
    const tempKey = `2fa_setup:${user.id}`;
    const setupData = await this.cacheManager.get<{
      secret: string;
      backupCodes: string[];
      createdAt: number;
    }>(tempKey);

    if (!setupData) {
      throw new BadRequestException(
        '2FA setup expired. Please request a new setup.',
      );
    }

    // Verify TOTP code
    const isValid = this.verifyTotp(code, setupData.secret);
    if (!isValid) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'verify', false, {
        reason: 'Invalid TOTP code',
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.throttleService.recordSuccess(user.id);

    // Enable 2FA for user
    user.twoFactorSecret = setupData.secret;
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = setupData.backupCodes;
    user.twoFactorEnabledAt = new Date();

    const savedUser = await this.userRepository.save(user);

    // Delete temporary data
    await this.cacheManager.del(tempKey);

    this.logAuditEvent(user.id, 'enable', true);
    this.logger.log(`2FA enabled for user ${user.id}`);

    return savedUser;
  }

  /**
   * Disable 2FA for user with TOTP verification
   */
  async disableWithTotp(user: User, code: string): Promise<User> {
    await this.throttleService.assertNotLockedOut(user.id);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('2FA secret not found');
    }

    // Verify TOTP code
    const isValid = this.verifyTotp(code, user.twoFactorSecret);
    if (!isValid) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'disable', false, {
        reason: 'Invalid TOTP code',
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.throttleService.recordSuccess(user.id);

    return this.disableTwoFactor(user);
  }

  /**
   * Disable 2FA using backup code
   */
  async disableWithBackupCode(user: User, backupCode: string): Promise<User> {
    await this.throttleService.assertNotLockedOut(user.id);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    if (!user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
      throw new BadRequestException('No backup codes available');
    }

    // Hash the provided backup code
    const hashedCode = this.hashBackupCode(backupCode);

    // Check if the code exists and is not used
    const codeIndex = user.twoFactorBackupCodes.indexOf(hashedCode);
    if (codeIndex === -1) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'recovery', false, {
        reason: 'Invalid backup code',
      });
      throw new UnauthorizedException('Invalid backup code');
    }
    await this.throttleService.recordSuccess(user.id);

    // Remove the used backup code
    user.twoFactorBackupCodes.splice(codeIndex, 1);

    // Disable 2FA
    const disabledUser = await this.disableTwoFactor(user);

    this.logAuditEvent(user.id, 'recovery', true, { usedBackupCode: true });
    this.logger.log(`2FA disabled via backup code for user ${user.id}`);

    return disabledUser;
  }

  /**
   * Regenerate backup codes for user
   */
  async regenerateBackupCodes(user: User, code: string): Promise<string[]> {
    await this.throttleService.assertNotLockedOut(user.id);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('2FA secret not found');
    }

    // Verify TOTP code
    const isValid = this.verifyTotp(code, user.twoFactorSecret);
    if (!isValid) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'regenerate', false, {
        reason: 'Invalid TOTP code',
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.throttleService.recordSuccess(user.id);

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();
    const hashedCodes = newBackupCodes.map((code) => this.hashBackupCode(code));

    // Update user
    user.twoFactorBackupCodes = hashedCodes;
    await this.userRepository.save(user);

    this.logAuditEvent(user.id, 'regenerate', true);
    this.logger.log(`Backup codes regenerated for user ${user.id}`);

    return newBackupCodes;
  }

  /**
   * Verify 2FA challenge during login
   */
  async verifyTwoFactorChallenge(
    tempToken: string,
    code: string,
  ): Promise<{ verified: boolean; user?: User; error?: string }> {
    // Get session data from Redis
    const sessionKey = `2fa_session:${tempToken}`;
    const sessionData = await this.cacheManager.get<{
      userId: string;
      createdAt: number;
      expiresAt: number;
    }>(sessionKey);

    if (!sessionData) {
      return {
        verified: false,
        error: 'Session expired. Please login again.',
      };
    }

    // Check if session is expired
    if (Date.now() > sessionData.expiresAt) {
      await this.cacheManager.del(sessionKey);
      return {
        verified: false,
        error: 'Session expired. Please login again.',
      };
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: sessionData.userId },
    });

    if (!user) {
      return {
        verified: false,
        error: 'User not found.',
      };
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return {
        verified: false,
        error: '2FA is not enabled for this user.',
      };
    }

    // Throws a distinct 429 (TWO_FACTOR_LOCKED_OUT) if this user has
    // exhausted their consecutive-failure budget — propagates past this
    // method's own {verified:false} result shape on purpose, so a lockout
    // is never indistinguishable from a wrong-code rejection downstream.
    await this.throttleService.assertNotLockedOut(user.id);

    // Verify TOTP code
    const isValid = this.verifyTotp(code, user.twoFactorSecret);
    if (!isValid) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'failed_attempt', false);
      return {
        verified: false,
        error: 'Invalid TOTP code',
      };
    }
    await this.throttleService.recordSuccess(user.id);

    // Delete session data (one-time use)
    await this.cacheManager.del(sessionKey);

    this.logAuditEvent(user.id, 'verify', true);

    return {
      verified: true,
      user,
    };
  }

  /**
   * Verify 2FA recovery with backup code during login
   */
  async verifyRecoveryChallenge(
    tempToken: string,
    backupCode: string,
  ): Promise<{ verified: boolean; user?: User; error?: string }> {
    // Get session data from Redis
    const sessionKey = `2fa_session:${tempToken}`;
    const sessionData = await this.cacheManager.get<{
      userId: string;
      createdAt: number;
      expiresAt: number;
    }>(sessionKey);

    if (!sessionData) {
      return {
        verified: false,
        error: 'Session expired. Please login again.',
      };
    }

    // Check if session is expired
    if (Date.now() > sessionData.expiresAt) {
      await this.cacheManager.del(sessionKey);
      return {
        verified: false,
        error: 'Session expired. Please login again.',
      };
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: sessionData.userId },
    });

    if (!user) {
      return {
        verified: false,
        error: 'User not found.',
      };
    }

    if (!user.twoFactorEnabled) {
      return {
        verified: false,
        error: '2FA is not enabled for this user.',
      };
    }

    if (!user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
      return {
        verified: false,
        error: 'No backup codes available.',
      };
    }

    // Throws a distinct 429 (TWO_FACTOR_LOCKED_OUT) if this user has
    // exhausted their consecutive-failure budget — same shared mechanism
    // and keying (by resolved user.id, not the ephemeral tempToken) as
    // verifyTwoFactorChallenge above.
    await this.throttleService.assertNotLockedOut(user.id);

    // Hash the provided backup code
    const hashedCode = this.hashBackupCode(backupCode);

    // Check if the code exists and is not used
    const codeIndex = user.twoFactorBackupCodes.indexOf(hashedCode);
    if (codeIndex === -1) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'failed_attempt', false, {
        type: 'recovery',
      });
      return {
        verified: false,
        error: 'Invalid backup code',
      };
    }
    await this.throttleService.recordSuccess(user.id);

    // Remove used backup code
    user.twoFactorBackupCodes.splice(codeIndex, 1);
    await this.userRepository.save(user);

    // Delete session data (one-time use)
    await this.cacheManager.del(sessionKey);

    this.logAuditEvent(user.id, 'recovery', true);

    return {
      verified: true,
      user,
    };
  }

  /**
   * Create temporary 2FA session during login
   */
  async createTwoFactorSession(userId: string): Promise<string> {
    const tempToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresIn = 300000; // 5 minutes

    const sessionData = {
      userId,
      createdAt: now,
      expiresAt: now + expiresIn,
    };

    const sessionKey = `2fa_session:${tempToken}`;
    await this.cacheManager.set(sessionKey, sessionData, expiresIn);

    this.logger.log(`2FA session created for user ${userId}`);

    return tempToken;
  }

  /**
   * Verify TOTP code using speakeasy
   */
  private verifyTotp(code: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: this.config.encoding,
      token: code,
      window: this.config.window,
      step: this.config.timeStep,
      algorithm: this.config.algorithm,
    });
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < this.config.backupCodeCount; i++) {
      const bytes = crypto.randomBytes(this.config.backupCodeLength);
      let code = '';
      for (let j = 0; j < bytes.length; j++) {
        code += alphabet[bytes[j] % alphabet.length];
      }
      // Format as XXXX-XXXX-XXXX-XXXX
      const formatted = code.match(/.{1,4}/g)?.join('-') || code;
      codes.push(formatted);
    }

    return codes;
  }

  /**
   * Hash backup code for storage
   */
  private hashBackupCode(code: string): string {
    const normalized = code.replace(/-/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Disable 2FA for user (internal method)
   */
  private async disableTwoFactor(user: User): Promise<User> {
    user.twoFactorSecret = undefined;
    user.twoFactorEnabled = false;
    user.twoFactorBackupCodes = [];
    user.twoFactorDisabledAt = new Date();

    const savedUser = await this.userRepository.save(user);

    this.logAuditEvent(user.id, 'disable', true);
    this.logger.log(`2FA disabled for user ${user.id}`);

    return savedUser;
  }

  /**
   * Log 2FA audit event
   */
  private logAuditEvent(
    userId: string,
    action: string,
    success: boolean,
    metadata?: Record<string, unknown>,
  ): void {
    const logEntry = {
      userId,
      action,
      success,
      timestamp: new Date(),
      metadata: metadata || {},
    };

    this.logger.log(`2FA Audit: ${JSON.stringify(logEntry)}`);

    // In production, you might want to store these in a database
    // For now, we just log them
  }

  /**
   * Get 2FA status for user
   */
  getTwoFactorStatus(user: User): Promise<{
    enabled: boolean;
    enabledAt?: Date;
    backupCodesRemaining: number;
  }> {
    return Promise.resolve({
      enabled: user.twoFactorEnabled || false,
      enabledAt: user.twoFactorEnabledAt || undefined,
      backupCodesRemaining: user.twoFactorBackupCodes?.length || 0,
    });
  }

  /**
   * Revoke all backup codes for user (requires TOTP verification)
   */
  async revokeBackupCodes(user: User, code: string): Promise<void> {
    await this.throttleService.assertNotLockedOut(user.id);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('2FA secret not found');
    }

    const isValid = this.verifyTotp(code, user.twoFactorSecret);
    if (!isValid) {
      await this.throttleService.recordFailure(user.id);
      this.logAuditEvent(user.id, 'revoke_backup_codes', false, {
        reason: 'Invalid TOTP code',
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.throttleService.recordSuccess(user.id);

    user.twoFactorBackupCodes = [];
    await this.userRepository.save(user);

    this.logAuditEvent(user.id, 'revoke_backup_codes', true);
    this.logger.log(`Backup codes revoked for user ${user.id}`);
  }

  /**
   * Admin override to disable 2FA for a user
   * Logs the admin action for auditing
   */
  async adminDisableTwoFactor(
    userId: string,
    adminId: string,
    reason?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    const disabledUser = await this.disableTwoFactor(user);

    this.logAuditEvent(user.id, 'admin_disable', true, {
      adminId,
      reason: reason || 'Admin override',
    });

    this.logger.warn(`2FA disabled by admin ${adminId} for user ${userId}`);

    return disabledUser;
  }

  /**
   * Check if a user has 2FA enabled
   */
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['twoFactorEnabled'],
    });
    return user?.twoFactorEnabled || false;
  }
}
