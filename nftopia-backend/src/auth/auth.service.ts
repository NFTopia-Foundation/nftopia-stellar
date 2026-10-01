import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { EmailLoginDto, EmailRegisterDto } from './dto/email-auth.dto';
import {
  WalletChallengeDto,
  WalletChallengeResponseDto,
} from './dto/wallet-challenge.dto';
import {
  WalletLinkDto,
  WalletUnlinkDto,
  WalletVerifyDto,
} from './dto/wallet-auth.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { WalletSession } from './entities/wallet-session.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { RefreshTokenFamily } from './entities/refresh-token-family.entity';
import { User } from '../users/user.entity';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';
import { TwoFactorService } from './two-factor.service';
import { EmailService } from '../modules/email/email.service';
import { WALLET_NONCE_STORE } from './wallet-nonce.store';
import type { WalletNonceStore } from './wallet-nonce.store';

type JwtUserPayload = {
  sub: string;
  username?: string;
  email?: string;
  walletAddress?: string;
  role?: string;
  twoFactorVerified?: boolean;
};

type JwtRefreshPayload = {
  sub: string;
  type: string;
  jti: string;
  familyId: string;
};

type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    address?: string | null;
    email?: string | null;
    username?: string | null;
    walletAddress?: string | null;
    walletProvider?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    role?: string | null;
  };
};

const scryptAsync = promisify(crypto.scrypt);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly emailVerificationTtlSeconds = parseInt(
    process.env.EMAIL_VERIFICATION_TTL_SECONDS || '86400',
    10,
  );
  private readonly passwordResetTtlSeconds = parseInt(
    process.env.PASSWORD_RESET_TTL_SECONDS || '3600',
    10,
  );
  private readonly challengeTtlSeconds = parseInt(
    process.env.WALLET_CHALLENGE_TTL_SECONDS || '300',
    10,
  );
  /**
   * Redis keeps a challenge this long past its expiry so a late verification
   * gets "expired" instead of the less helpful "not found".
   */
  private readonly challengeExpiredGraceSeconds = 60;
  private readonly challengeRateLimitMax = parseInt(
    process.env.WALLET_CHALLENGE_RATE_LIMIT_MAX || '5',
    10,
  );
  private readonly challengeRateLimitWindowMs = parseInt(
    process.env.WALLET_CHALLENGE_RATE_LIMIT_WINDOW_MS || '60000',
    10,
  );
  private readonly refreshTokenTtlSeconds = parseInt(
    process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || '604800',
    10,
  );
  private readonly twoFactorTempTokenExpirySeconds = parseInt(
    process.env.TWO_FACTOR_TEMP_TOKEN_EXPIRY_SECONDS || '300',
    10,
  );
  private readonly challengeRateLimitByIp = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly stellarStrategy: StellarSignatureStrategy,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly userWalletRepository: Repository<UserWallet>,
    @InjectRepository(WalletSession)
    private readonly walletSessionRepository: Repository<WalletSession>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(RefreshTokenFamily)
    private readonly refreshTokenFamilyRepository: Repository<RefreshTokenFamily>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(forwardRef(() => TwoFactorService))
    private readonly twoFactorService: TwoFactorService,
    private readonly emailService: EmailService,
    @Inject(WALLET_NONCE_STORE)
    private readonly walletNonceStore: WalletNonceStore,
  ) {}

  async registerWithEmail(dto: EmailRegisterDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.userRepository.save(
      this.userRepository.create({
        email: normalizedEmail,
        passwordHash,
        username: dto.username,
        isEmailVerified: false,
        twoFactorEnabled: false,
      }),
    );

    await this.issueEmailVerificationToken(user);

    return await this.buildAuthResponse(user);
  }

  /**
   * Verify a user's email using the token issued at registration
   * (or via resend). Tokens are single-use and expire after
   * EMAIL_VERIFICATION_TTL_SECONDS.
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<{ success: boolean }> {
    const key = `email-verify:${this.hashToken(dto.token)}`;
    const cached = await this.cacheManager.get<{ userId: string }>(key);

    if (!cached) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.userRepository.update(
      { id: cached.userId },
      { isEmailVerified: true },
    );
    await this.cacheManager.del(key);

    return { success: true };
  }

  /**
   * Generate a password reset token and email it to the user.
   * Always resolves with { success: true } regardless of whether the
   * email is registered, to avoid leaking account existence.
   */
  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<{ success: boolean }> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.email) {
      return { success: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const key = `password-reset:${this.hashToken(token)}`;

    await this.cacheManager.set(
      key,
      { userId: user.id },
      this.passwordResetTtlSeconds * 1000,
    );

    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        token,
        user.username ?? undefined,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${(err as Error).message}`,
      );
    }

    return { success: true };
  }

  /**
   * Consume a password reset token and update the user's password hash.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const key = `password-reset:${this.hashToken(dto.token)}`;
    const cached = await this.cacheManager.get<{ userId: string }>(key);

    if (!cached) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.userRepository.update({ id: cached.userId }, { passwordHash });
    await this.cacheManager.del(key);

    return { success: true };
  }

  async loginWithEmail(dto: EmailLoginDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await this.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Create temporary session and return temp token
      const tempToken = await this.twoFactorService.createTwoFactorSession(
        user.id,
      );
      return {
        requiresTwoFactor: true,
        tempToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      };
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return await this.buildAuthResponse(user);
  }

  async generateWalletChallenge(
    dto: WalletChallengeDto,
    requestIp?: string,
  ): Promise<WalletChallengeResponseDto> {
    this.assertChallengeRateLimit(requestIp);

    if (!this.stellarStrategy.isValidPublicKey(dto.walletAddress)) {
      throw new BadRequestException('Invalid Stellar wallet address');
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + this.challengeTtlSeconds * 1000,
    );
    const message = this.buildChallengeMessage(
      dto.walletAddress,
      nonce,
      issuedAt,
    );

    // Store the nonce in Redis so it survives restarts and is visible to
    // every backend instance (#572).
    const sessionKey = `nonce:${dto.walletAddress}`;
    await this.walletNonceStore.issue(
      {
        nonce,
        challengeMessage: message,
        walletAddress: dto.walletAddress,
        walletProvider: dto.walletProvider,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        ipAddress: requestIp,
      },
      this.challengeTtlSeconds + this.challengeExpiredGraceSeconds,
    );

    return {
      sessionId: sessionKey,
      walletAddress: dto.walletAddress,
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyWalletChallenge(dto: WalletVerifyDto) {
    if (!this.stellarStrategy.isValidPublicKey(dto.walletAddress)) {
      throw new BadRequestException('Invalid Stellar wallet address');
    }

    const sessionData = await this.walletNonceStore.find(dto.walletAddress);

    if (!sessionData) {
      throw new UnauthorizedException(
        'Wallet challenge not found or expired. Request a new challenge.',
      );
    }

    if (new Date(sessionData.expiresAt) <= new Date()) {
      await this.walletNonceStore.discard(dto.walletAddress);
      throw new UnauthorizedException(
        'Wallet challenge has expired. Request a new challenge.',
      );
    }

    if (sessionData.nonce !== dto.nonce) {
      throw new UnauthorizedException('Invalid nonce');
    }

    const isValidSignature = this.stellarStrategy.verifySignedMessage(
      dto.walletAddress,
      sessionData.challengeMessage,
      dto.signature,
    );

    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    // Consume atomically before any side effects: if another request (on
    // this or another instance) already used this nonce, it cannot be
    // replayed.
    const consumed = await this.walletNonceStore.consume(
      dto.walletAddress,
      dto.nonce,
    );
    if (!consumed) {
      throw new UnauthorizedException(
        'Wallet challenge has already been used. Request a new challenge.',
      );
    }

    const user = await this.resolveUserByWallet(
      dto.walletAddress,
      dto.walletProvider || sessionData.walletProvider,
    );

    await this.upsertLinkedWallet(
      user.id,
      dto.walletAddress,
      dto.walletProvider,
      true,
    );

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Create temporary session and return temp token
      const tempToken = await this.twoFactorService.createTwoFactorSession(
        user.id,
      );
      return {
        requiresTwoFactor: true,
        tempToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          walletAddress: user.walletAddress,
          walletProvider: user.walletProvider,
        },
      };
    }

    return await this.buildAuthResponse(user);
  }

  async linkWallet(userId: string, dto: WalletLinkDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingWallet = await this.userWalletRepository.findOne({
      where: { walletAddress: dto.walletAddress },
    });

    if (existingWallet && existingWallet.userId !== userId) {
      throw new ConflictException('Wallet is already linked to another user');
    }

    const session = await this.walletSessionRepository.findOne({
      where: {
        walletAddress: dto.walletAddress,
        nonce: dto.nonce,
        consumedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (!session || session.nonceExpiresAt <= new Date()) {
      throw new UnauthorizedException('Wallet challenge is invalid or expired');
    }

    const isValid = this.stellarStrategy.verifySignedMessage(
      dto.walletAddress,
      session.challengeMessage,
      dto.signature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const linked = await this.upsertLinkedWallet(
      userId,
      dto.walletAddress,
      dto.walletProvider,
      false,
    );

    session.userId = userId;
    session.consumedAt = new Date();
    await this.walletSessionRepository.save(session);

    return {
      success: true,
      wallet: linked,
    };
  }

  async unlinkWallet(userId: string, dto: WalletUnlinkDto) {
    const wallet = await this.userWalletRepository.findOne({
      where: {
        userId,
        walletAddress: dto.walletAddress,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet is not linked to the current user');
    }

    const linkedWalletCount = await this.userWalletRepository.count({
      where: { userId },
    });

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (linkedWalletCount <= 1 && !user.email) {
      throw new BadRequestException(
        'Cannot unlink the only wallet from a wallet-only account.',
      );
    }

    await this.userWalletRepository.delete({ id: wallet.id });

    if (wallet.isPrimary) {
      const nextPrimary = await this.userWalletRepository.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });

      if (nextPrimary) {
        nextPrimary.isPrimary = true;
        await this.userWalletRepository.save(nextPrimary);

        await this.userRepository.update(
          { id: userId },
          {
            walletAddress: nextPrimary.walletAddress,
            walletPublicKey: nextPrimary.walletAddress,
            walletProvider: nextPrimary.walletProvider,
            walletConnectedAt: new Date(),
          },
        );
      } else {
        await this.userRepository.update(
          { id: userId },
          {
            walletAddress: null,
            walletPublicKey: null,
            walletProvider: null,
            walletConnectedAt: null,
          },
        );
      }
    }

    return { success: true };
  }

  async listActiveWalletSessions(userId: string) {
    return this.walletSessionRepository.find({
      where: {
        userId,
        nonceExpiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async terminateWalletSession(userId: string, sessionId: string) {
    const session = await this.walletSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Wallet session not found');
    }

    await this.walletSessionRepository.delete({ id: sessionId, userId });
    return { success: true };
  }

  async listUserWallets(userId: string) {
    return this.userWalletRepository.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async generateChallenge(publicKey: string) {
    return this.generateWalletChallenge(
      { walletAddress: publicKey },
      'legacy-route',
    );
  }

  validateStellarTransaction(): null {
    return null;
  }

  async login(user: JwtUserPayload) {
    const family = await this.createRefreshTokenFamily(user.sub);
    return this.issueTokenPair(user, family.id, this.refreshTokenRepository);
  }

  /**
   * Build auth response with a new refresh-token family.
   *
   * Each successful authentication event starts a new family. Refreshes
   * rotate tokens inside that family until the family is revoked.
   */
  async buildAuthResponse(user: User): Promise<AuthResponse> {
    const resolvedWalletAddress =
      user.walletAddress ?? user.address ?? undefined;
    const resolvedEmail = user.email ?? undefined;
    const family = await this.createRefreshTokenFamily(user.id);

    const tokenPair = await this.issueTokenPair(
      {
        sub: user.id,
        username: user.username,
        email: resolvedEmail,
        walletAddress: resolvedWalletAddress,
        role: user.role,
        twoFactorVerified: true,
      },
      family.id,
      this.refreshTokenRepository,
    );

    return {
      ...tokenPair,
      user: {
        id: user.id,
        address: user.address,
        email: resolvedEmail,
        username: user.username,
        walletAddress: resolvedWalletAddress,
        walletProvider: user.walletProvider,
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
        role: user.role ?? null,
      },
    };
  }

  /**
   * Rotate a refresh token exactly once.
   *
   * The refresh-token row is locked for the duration of the transaction so
   * concurrent requests cannot both consume the same token. Reuse of an
   * already-consumed token revokes its entire family.
   */
  async refreshTokens(refreshToken: string) {
    let payload: JwtRefreshPayload;

    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      payload.type !== 'refresh' ||
      !payload.jti ||
      !payload.familyId ||
      !payload.sub
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(RefreshToken);
      const familyRepository = manager.getRepository(RefreshTokenFamily);

      const token = await tokenRepository.findOne({
        where: {
          jti: payload.jti,
          userId: payload.sub,
          familyId: payload.familyId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!token) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const family = await familyRepository.findOne({
        where: { id: token.familyId, userId: payload.sub },
        lock: { mode: 'pessimistic_write' },
      });

      if (!family || family.revokedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (token.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (token.usedAt || token.revokedAt) {
        family.revokedAt = new Date();
        await familyRepository.save(family);
        return { reuseDetected: true as const };
      }

      const presentedHash = this.hashToken(refreshToken);
      const storedHash = Buffer.from(token.tokenHash, 'hex');
      const incomingHash = Buffer.from(presentedHash, 'hex');

      if (
        storedHash.length !== incomingHash.length ||
        !crypto.timingSafeEqual(storedHash, incomingHash)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      token.usedAt = new Date();
      await tokenRepository.save(token);

      return {
        reuseDetected: false as const,
        tokenPair: await this.issueTokenPair(
          {
            sub: user.id,
            username: user.username,
            email: user.email ?? undefined,
            walletAddress: user.walletAddress ?? user.address ?? undefined,
            role: user.role,
            twoFactorVerified: true,
          },
          family.id,
          tokenRepository,
        ),
      };
    });

    if (result.reuseDetected) {
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return result.tokenPair;
  }

  private async createRefreshTokenFamily(
    userId: string,
  ): Promise<RefreshTokenFamily> {
    const family = this.refreshTokenFamilyRepository.create({
      id: crypto.randomUUID(),
      userId,
    });
    return this.refreshTokenFamilyRepository.save(family);
  }

  private async issueTokenPair(
    user: JwtUserPayload,
    familyId: string,
    refreshTokenRepository: Repository<RefreshToken>,
  ) {
    const accessToken = this.jwtService.sign({
      sub: user.sub,
      username: user.username,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
      twoFactorVerified: user.twoFactorVerified || false,
      type: 'access',
    });

    const jti = crypto.randomUUID();
    const refreshToken = this.jwtService.sign(
      {
        sub: user.sub,
        type: 'refresh',
        jti,
        familyId,
      },
      { expiresIn: this.refreshTokenTtlSeconds },
    );

    const refreshTokenEntity = refreshTokenRepository.create({
      id: crypto.randomUUID(),
      jti,
      familyId,
      userId: user.sub,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
    });

    await refreshTokenRepository.save(refreshTokenEntity);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Get user with 2FA status
   */
  async getUserWithTwoFactorStatus(userId: string): Promise<{
    user: User;
    twoFactorEnabled: boolean;
  } | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      return null;
    }
    return {
      user,
      twoFactorEnabled: user.twoFactorEnabled || false,
    };
  }

  private assertChallengeRateLimit(requestIp?: string) {
    const key = requestIp || 'unknown';
    const now = Date.now();
    const current = this.challengeRateLimitByIp.get(key);

    if (
      !current ||
      now - current.windowStart > this.challengeRateLimitWindowMs
    ) {
      this.challengeRateLimitByIp.set(key, { count: 1, windowStart: now });
      return;
    }

    if (current.count >= this.challengeRateLimitMax) {
      throw new HttpException(
        'Too many wallet challenge requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.challengeRateLimitByIp.set(key, current);
  }

  private buildChallengeMessage(
    walletAddress: string,
    nonce: string,
    issuedAt: Date,
  ): string {
    return [
      'NFTopia Wallet Authentication',
      `Wallet: ${walletAddress}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expires In: ${this.challengeTtlSeconds}s`,
    ].join('\n');
  }

  private async resolveUserByWallet(
    walletAddress: string,
    walletProvider?: string,
  ): Promise<User> {
    const existingWallet = await this.userWalletRepository.findOne({
      where: { walletAddress },
    });

    if (existingWallet) {
      const existingUser = await this.userRepository.findOne({
        where: { id: existingWallet.userId },
      });

      if (!existingUser) {
        throw new NotFoundException('Linked user not found');
      }

      return existingUser;
    }

    const byPrimaryWallet = await this.userRepository.findOne({
      where: [{ walletAddress }, { address: walletAddress }],
    });

    if (byPrimaryWallet) {
      return byPrimaryWallet;
    }

    return this.userRepository.save(
      this.userRepository.create({
        address: walletAddress,
        walletAddress,
        walletPublicKey: walletAddress,
        walletProvider: walletProvider || 'freighter',
        walletConnectedAt: new Date(),
        twoFactorEnabled: false,
      }),
    );
  }

  private async upsertLinkedWallet(
    userId: string,
    walletAddress: string,
    walletProvider?: string,
    makePrimary = false,
  ) {
    const existing = await this.userWalletRepository.findOne({
      where: { userId, walletAddress },
    });

    if (existing) {
      existing.walletProvider = walletProvider || existing.walletProvider;
      existing.lastUsedAt = new Date();
      if (makePrimary) {
        existing.isPrimary = true;
      }
      const saved = await this.userWalletRepository.save(existing);
      await this.syncPrimaryWallet(
        userId,
        saved.walletAddress,
        saved.walletProvider,
      );
      return saved;
    }

    if (makePrimary) {
      await this.userWalletRepository.update({ userId }, { isPrimary: false });
    }

    const created = await this.userWalletRepository.save(
      this.userWalletRepository.create({
        userId,
        walletAddress,
        walletProvider: walletProvider || 'freighter',
        isPrimary: makePrimary,
        lastUsedAt: new Date(),
      }),
    );

    await this.syncPrimaryWallet(
      userId,
      created.walletAddress,
      created.walletProvider,
    );
    return created;
  }

  private async syncPrimaryWallet(
    userId: string,
    walletAddress: string,
    walletProvider: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const resolvedAddress = user?.address || walletAddress;

    await this.userRepository.update(
      { id: userId },
      {
        address: resolvedAddress,
        walletAddress,
        walletPublicKey: walletAddress,
        walletProvider,
        walletConnectedAt: new Date(),
      },
    );
  }

  private async issueEmailVerificationToken(user: User): Promise<void> {
    if (!user.email) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const key = `email-verify:${this.hashToken(token)}`;

    await this.cacheManager.set(
      key,
      { userId: user.id },
      this.emailVerificationTtlSeconds * 1000,
    );

    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        token,
        user.username ?? undefined,
      );
    } catch (err) {
      // Registration must succeed even if the email provider is down.
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${(err as Error).message}`,
      );
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    storedPasswordHash: string,
  ): Promise<boolean> {
    const [salt, storedHash] = storedPasswordHash.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const derivedHash = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedHashBuffer = Buffer.from(storedHash, 'hex');

    if (storedHashBuffer.length !== derivedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedHashBuffer, derivedHash);
  }

  private buildTokenPair(user: JwtUserPayload) {
    const accessToken = this.jwtService.sign({
      sub: user.sub,
      username: user.username,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
      twoFactorVerified: user.twoFactorVerified || false,
      type: 'access',
    });
    const refreshToken = this.jwtService.sign(
      {
        sub: user.sub,
        type: 'refresh',
      },
      { expiresIn: this.refreshTokenTtlSeconds },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
