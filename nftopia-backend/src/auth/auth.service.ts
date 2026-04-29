import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
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
import { WalletSession } from './entities/wallet-session.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { User } from '../users/user.entity';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';

type JwtUserPayload = {
  sub: string;
  username?: string;
  email?: string;
  walletAddress?: string;
};

const scryptAsync = promisify(crypto.scrypt);

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly userWalletRepository: Repository<UserWallet>,
    @InjectRepository(WalletSession)
    private readonly walletSessionRepository: Repository<WalletSession>,
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

    const session = this.walletSessionRepository.create({
      walletAddress: dto.walletAddress,
      walletProvider: dto.walletProvider,
      nonce,
      challengeMessage: message,
      nonceExpiresAt: expiresAt,
      ipAddress: requestIp,
    });

    const saved = await this.walletSessionRepository.save(session);

    return {
      sessionId: saved.id,
      walletAddress: saved.walletAddress,
      nonce: saved.nonce,
      message: saved.challengeMessage,
      expiresAt: saved.nonceExpiresAt.toISOString(),
    };
  }

  async verifyWalletChallenge(dto: WalletVerifyDto) {
    if (!this.stellarStrategy.isValidPublicKey(dto.walletAddress)) {
      throw new BadRequestException('Invalid Stellar wallet address');
    }

    const session = await this.walletSessionRepository.findOne({
      where: {
        walletAddress: dto.walletAddress,
        nonce: dto.nonce,
        consumedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (!session) {
      throw new UnauthorizedException('Wallet challenge not found');
    }

    if (session.nonceExpiresAt <= new Date()) {
      throw new UnauthorizedException('Wallet challenge has expired');
    }

    const isValidSignature = this.stellarStrategy.verifySignedMessage(
      dto.walletAddress,
      session.challengeMessage,
      dto.signature,
    );

    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const user = await this.resolveUserByWallet(
      dto.walletAddress,
      dto.walletProvider || session.walletProvider,
    );

    await this.upsertLinkedWallet(
      user.id,
      dto.walletAddress,
      dto.walletProvider,
      true,
    );

    session.userId = user.id;
    session.consumedAt = new Date();
    await this.walletSessionRepository.save(session);

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
      },
    };
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
