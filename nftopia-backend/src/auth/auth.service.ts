import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { IsNull, MoreThan, Repository } from 'typeorm';
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
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password-reset.dto';
import { WalletSession } from './entities/wallet-session.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { User } from '../users/user.entity';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';
import { EmailService } from '../modules/email/email.service';

type JwtUserPayload = {
  sub: string;
  username?: string;
  email?: string;
  walletAddress?: string;
};

type JwtRefreshPayload = {
  sub: string;
  type: string;
};

const scryptAsync = promisify(crypto.scrypt);

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_RATE_WINDOW_MS = 5 * 60 * 1000;
const EMAIL_RATE_MAX = 3;

@Injectable()
export class AuthService {
  private readonly challengeTtlSeconds = parseInt(
    process.env.WALLET_CHALLENGE_TTL_SECONDS || '300',
    10,
  );
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
  private readonly challengeRateLimitByIp = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly stellarStrategy: StellarSignatureStrategy,
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly userWalletRepository: Repository<UserWallet>,
    @InjectRepository(WalletSession)
    private readonly walletSessionRepository: Repository<WalletSession>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
      }),
    );

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.cacheManager.set(
      `email-verify:${verificationToken}`,
      { userId: user.id, email: normalizedEmail },
      EMAIL_VERIFY_TTL_MS,
    );

    this.emailService.sendAsync(() =>
      this.emailService.sendVerificationEmail(
        normalizedEmail,
        verificationToken,
        dto.username,
      ),
    );

    return this.buildAuthResponse(user);
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

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.buildAuthResponse(user);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const data = await this.cacheManager.get<{ userId: string; email: string }>(
      `email-verify:${dto.token}`,
    );

    if (!data) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.userRepository.findOne({
      where: { id: data.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      await this.cacheManager.del(`email-verify:${dto.token}`);
      return { success: true, message: 'Email already verified' };
    }

    user.isEmailVerified = true;
    await this.userRepository.save(user);
    await this.cacheManager.del(`email-verify:${dto.token}`);

    return { success: true, message: 'Email verified successfully' };
  }

  async resendVerificationEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    await this.assertEmailRateLimit(normalizedEmail);

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: true };
    }

    if (user.isEmailVerified) {
      return { success: true };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.cacheManager.set(
      `email-verify:${verificationToken}`,
      { userId: user.id, email: normalizedEmail },
      EMAIL_VERIFY_TTL_MS,
    );

    this.emailService.sendAsync(() =>
      this.emailService.sendVerificationEmail(
        normalizedEmail,
        verificationToken,
        user.username,
      ),
    );

    return { success: true };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    await this.assertEmailRateLimit(normalizedEmail);

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.cacheManager.set(
      `pwd-reset:${resetToken}`,
      { userId: user.id, email: normalizedEmail },
      PASSWORD_RESET_TTL_MS,
    );

    this.emailService.sendAsync(() =>
      this.emailService.sendPasswordResetEmail(
        normalizedEmail,
        resetToken,
        user.username,
      ),
    );

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const data = await this.cacheManager.get<{ userId: string; email: string }>(
      `pwd-reset:${dto.token}`,
    );

    if (!data) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = await this.userRepository.findOne({
      where: { id: data.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.passwordHash = await this.hashPassword(dto.newPassword);
    await this.userRepository.save(user);
    await this.cacheManager.del(`pwd-reset:${dto.token}`);

    return { success: true, message: 'Password reset successfully' };
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

    const sessionKey = `nonce:${dto.walletAddress}`;
    const sessionData = {
      nonce,
      challengeMessage: message,
      walletAddress: dto.walletAddress,
      walletProvider: dto.walletProvider,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress: requestIp,
    };

    await this.cacheManager.set(
      sessionKey,
      sessionData,
      this.challengeTtlSeconds * 1000,
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

    const sessionKey = `nonce:${dto.walletAddress}`;
    const sessionData = await this.cacheManager.get<{
      nonce: string;
      challengeMessage: string;
      walletAddress: string;
      walletProvider?: string;
      issuedAt: string;
      expiresAt: string;
      ipAddress?: string;
    }>(sessionKey);

    if (!sessionData) {
      throw new UnauthorizedException('Wallet challenge not found');
    }

    if (new Date(sessionData.expiresAt) <= new Date()) {
      await this.cacheManager.del(sessionKey);
      throw new UnauthorizedException('Wallet challenge has expired');
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

    await this.cacheManager.del(sessionKey);

    return this.buildAuthResponse(user);
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

  login(user: JwtUserPayload) {
    return this.buildTokenPair(user);
  }

  private async assertEmailRateLimit(email: string): Promise<void> {
    const key = `email-rate:${email}`;
    const rateData = await this.cacheManager.get<{
      count: number;
      windowStart: number;
    }>(key);
    const now = Date.now();

    if (!rateData || now - rateData.windowStart > EMAIL_RATE_WINDOW_MS) {
      await this.cacheManager.set(
        key,
        { count: 1, windowStart: now },
        EMAIL_RATE_WINDOW_MS,
      );
      return;
    }

    if (rateData.count >= EMAIL_RATE_MAX) {
      throw new HttpException(
        'Too many email requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(
      key,
      { count: rateData.count + 1, windowStart: rateData.windowStart },
      EMAIL_RATE_WINDOW_MS,
    );
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

  private buildAuthResponse(user: User) {
    const resolvedWalletAddress =
      user.walletAddress ?? user.address ?? undefined;
    const resolvedEmail = user.email ?? undefined;

    const tokenPair = this.buildTokenPair({
      sub: user.id,
      username: user.username,
      email: resolvedEmail,
      walletAddress: resolvedWalletAddress,
    });

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
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private buildTokenPair(user: JwtUserPayload) {
    const accessToken = this.jwtService.sign({
      sub: user.sub,
      username: user.username,
      email: user.email,
      walletAddress: user.walletAddress,
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
