import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { User } from '../users/user.entity';

const BACKUP_CODE_COUNT = 10;
const TOTP_RATE_LIMIT_MAX = 5;
const TOTP_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const TWO_FA_PENDING_TTL_SECONDS = 300; // 5 minutes

interface PendingTokenPayload {
  sub: string;
  type: '2fa_pending';
  iat?: number;
  exp?: number;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly totpRateLimitByUser = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Step 1: Generate a new TOTP secret and return QR code data URL.
   * Secret is NOT persisted until /2fa/verify succeeds.
   */
  async initSetup(
    userId: string,
  ): Promise<{ secret: string; qrCodeDataUrl: string; otpauthUrl: string }> {
    const user = await this.requireUser(userId);

    if (user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled for this account');
    }

    const secret = authenticator.generateSecret();
    const appName = process.env.APP_NAME || 'NFTopia';
    const accountLabel = user.email ?? user.username ?? user.id;
    const otpauthUrl = authenticator.keyuri(accountLabel, appName, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return { secret, qrCodeDataUrl, otpauthUrl };
  }

  /**
   * Step 2: Verify the TOTP code and enable 2FA, returning backup codes.
   * The secret passed here must be the one returned by initSetup().
   */
  async enable(
    userId: string,
    secret: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.requireUser(userId);

    if (user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const { plainCodes, hashedCodes } = this.generateBackupCodes();

    await this.userRepository.update(
      { id: userId },
      {
        twoFactorSecret: secret,
        isTwoFactorEnabled: true,
        twoFactorBackupCodes: hashedCodes,
        twoFactorEnabledAt: new Date(),
        twoFactorDisabledAt: null,
      },
    );

    this.logger.log(`2FA enabled for user ${userId}`);
    return { backupCodes: plainCodes };
  }

  /**
   * Verify a TOTP code for an already-enabled user.
   * Enforces per-user rate limiting (5 attempts/minute).
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    this.assertTotpRateLimit(userId);

    const user = await this.requireUser(userId);

    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled for this account');
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      this.logger.warn(`Failed 2FA attempt for user ${userId}`);
    }
    return isValid;
  }

  /** Validate a 2fa_pending JWT and verify the TOTP code, returning full auth tokens. */
  async completeTwoFactorChallenge(
    pendingToken: string,
    code: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    let payload: PendingTokenPayload;
    try {
      payload = this.jwtService.verify<PendingTokenPayload>(pendingToken, {
        secret:
          process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const isValid = await this.verifyCode(payload.sub, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const user = await this.requireUser(payload.sub);
    return this.buildFullTokens(user);
  }

  /** Disable 2FA after verifying an active TOTP code. */
  async disable(userId: string, code: string): Promise<void> {
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.userRepository.update(
      { id: userId },
      {
        twoFactorSecret: null,
        isTwoFactorEnabled: false,
        twoFactorBackupCodes: null,
        twoFactorDisabledAt: new Date(),
      },
    );

    this.logger.log(`2FA disabled for user ${userId}`);
  }

  /** Disable 2FA using a backup code (recovery path). */
  async recover(userId: string, backupCode: string): Promise<void> {
    const user = await this.requireUser(userId);

    if (!user.isTwoFactorEnabled || !user.twoFactorBackupCodes?.length) {
      throw new BadRequestException('2FA is not enabled for this account');
    }

    const inputHash = this.hashBackupCode(backupCode.trim().toUpperCase());
    const index = user.twoFactorBackupCodes.findIndex(
      (h) => h === inputHash,
    );

    if (index === -1) {
      throw new UnauthorizedException('Invalid backup code');
    }

    await this.userRepository.update(
      { id: userId },
      {
        twoFactorSecret: null,
        isTwoFactorEnabled: false,
        twoFactorBackupCodes: null,
        twoFactorDisabledAt: new Date(),
      },
    );

    this.logger.log(`2FA recovered (backup code) for user ${userId}`);
  }

  /** Regenerate backup codes (requires valid TOTP to prove possession of device). */
  async regenerateBackupCodes(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const { plainCodes, hashedCodes } = this.generateBackupCodes();

    await this.userRepository.update(
      { id: userId },
      { twoFactorBackupCodes: hashedCodes },
    );

    this.logger.log(`Backup codes regenerated for user ${userId}`);
    return { backupCodes: plainCodes };
  }

  /** Build a short-lived "2FA pending" JWT for users who need a TOTP challenge. */
  buildPendingToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, type: '2fa_pending' },
      {
        secret:
          process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: TWO_FA_PENDING_TTL_SECONDS,
      },
    );
  }

  // ── private helpers ────────────────────────────────────────────────────

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private generateBackupCodes(): {
    plainCodes: string[];
    hashedCodes: string[];
  } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const plain = crypto
        .randomBytes(5)
        .toString('hex')
        .toUpperCase()
        .slice(0, 8);
      plainCodes.push(plain);
      hashedCodes.push(this.hashBackupCode(plain));
    }

    return { plainCodes, hashedCodes };
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private assertTotpRateLimit(userId: string) {
    const now = Date.now();
    const current = this.totpRateLimitByUser.get(userId);

    if (!current || now - current.windowStart > TOTP_RATE_LIMIT_WINDOW_MS) {
      this.totpRateLimitByUser.set(userId, { count: 1, windowStart: now });
      return;
    }

    if (current.count >= TOTP_RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many 2FA attempts. Please wait before retrying.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.totpRateLimitByUser.set(userId, current);
  }

  private buildFullTokens(user: User): {
    access_token: string;
    refresh_token: string;
  } {
    const refreshTtl = parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || '604800',
      10,
    );
    const secret =
      process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    const access_token = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress ?? user.address,
        type: 'access',
      },
      { secret },
    );

    const refresh_token = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { secret, expiresIn: refreshTtl },
    );

    return { access_token, refresh_token };
  }
}
