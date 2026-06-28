import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { WalletSession } from './entities/wallet-session.entity';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';
import { EmailService } from '../modules/email/email.service';

describe('AuthService', () => {
  let service: AuthService;

  const userRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const userWalletRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const walletSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn(),
  };

  const stellarStrategy = {
    isValidPublicKey: jest.fn(),
    verifySignedMessage: jest.fn(),
  };

  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const emailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendBidNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendAuctionWonEmail: jest.fn().mockResolvedValue(undefined),
    sendAsync: jest.fn((fn: () => Promise<void>) => { fn().catch(() => {}); }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: StellarSignatureStrategy,
          useValue: stellarStrategy,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(UserWallet),
          useValue: userWalletRepository,
        },
        {
          provide: getRepositoryToken(WalletSession),
          useValue: walletSessionRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  // ── wallet challenge ────────────────────────────────────────────────────────

  it('generates a wallet challenge session', async () => {
    stellarStrategy.isValidPublicKey.mockReturnValue(true);
    cacheManager.set.mockResolvedValue(undefined);

    const result = await service.generateWalletChallenge(
      {
        walletAddress:
          'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        walletProvider: 'freighter',
      },
      '127.0.0.1',
    );

    expect(result.sessionId).toContain('nonce:');
    expect(result.walletAddress).toEqual(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    );
    expect(result.nonce).toBeTruthy();
    expect(result.message).toContain('NFTopia Wallet Authentication');
    expect(cacheManager.set).toHaveBeenCalled();
  });

  it('rejects invalid signatures during wallet verification', async () => {
    stellarStrategy.isValidPublicKey.mockReturnValue(true);
    walletSessionRepository.findOne.mockResolvedValue({
      id: 'session-1',
      walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      nonce: 'nonce-1',
      challengeMessage: 'test-message',
      nonceExpiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    stellarStrategy.verifySignedMessage.mockReturnValue(false);

    await expect(
      service.verifyWalletChallenge({
        walletAddress:
          'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        nonce: 'nonce-1',
        signature: Buffer.from('invalid').toString('base64'),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies wallet challenge and returns token pair', async () => {
    const walletAddress =
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

    stellarStrategy.isValidPublicKey.mockReturnValue(true);
    stellarStrategy.verifySignedMessage.mockReturnValue(true);

    cacheManager.get.mockResolvedValue({
      nonce: 'nonce-1',
      challengeMessage: 'challenge-message',
      walletAddress,
      walletProvider: 'freighter',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    userWalletRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    userRepository.findOne.mockResolvedValue(null);
    const createdUser = {
      address: walletAddress,
      walletAddress,
      walletProvider: 'freighter',
      walletConnectedAt: new Date(),
    };
    userRepository.create.mockReturnValue(createdUser);
    userRepository.save.mockResolvedValue({
      id: 'user-1',
      ...createdUser,
      walletProvider: 'freighter',
      username: null,
    });

    userWalletRepository.update.mockResolvedValue(undefined);
    const createdWallet = {
      userId: 'user-1',
      walletAddress,
      walletProvider: 'freighter',
      isPrimary: true,
      lastUsedAt: new Date(),
    };
    userWalletRepository.create.mockReturnValue(createdWallet);
    userWalletRepository.save.mockResolvedValue({
      id: 'wallet-1',
      ...createdWallet,
    });

    userRepository.update.mockResolvedValue(undefined);
    cacheManager.del.mockResolvedValue(undefined);

    jwtService.sign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');

    const result = await service.verifyWalletChallenge({
      walletAddress,
      nonce: 'nonce-1',
      signature: Buffer.from('signed').toString('base64'),
    });

    expect(result.access_token).toEqual('access-token');
    expect(result.refresh_token).toEqual('refresh-token');
    expect(result.user.id).toEqual('user-1');
    expect(result.user.walletAddress).toEqual(walletAddress);
    expect(cacheManager.get).toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalled();
  });

  // ── email registration ──────────────────────────────────────────────────────

  it('registers with email/password and returns tokens', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.create.mockReturnValue({
      email: 'user@nftopia.io',
      username: 'user1',
      passwordHash: 'salt:hash',
    });
    userRepository.save.mockResolvedValue({
      id: 'user-email-1',
      email: 'user@nftopia.io',
      username: 'user1',
      passwordHash: 'salt:hash',
      isEmailVerified: false,
    });
    cacheManager.set.mockResolvedValue(undefined);
    jwtService.sign
      .mockReturnValueOnce('access-token-email')
      .mockReturnValueOnce('refresh-token-email');

    const result = await service.registerWithEmail({
      email: 'User@Nftopia.io',
      password: 'A_secure1!',
      username: 'user1',
    });

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'user@nftopia.io' },
    });
    expect(result.access_token).toBe('access-token-email');
    expect(result.refresh_token).toBe('refresh-token-email');
    expect(result.user.email).toBe('user@nftopia.io');
    expect(cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('email-verify:'),
      expect.objectContaining({ userId: 'user-email-1' }),
      expect.any(Number),
    );
    expect(emailService.sendAsync).toHaveBeenCalled();
  });

  it('fails email registration when email already exists', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.registerWithEmail({
        email: 'user@nftopia.io',
        password: 'A_secure1!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects email login when password is invalid', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-email-2',
      email: 'user@nftopia.io',
      passwordHash: 'salt:invalidhash',
    });

    await expect(
      service.loginWithEmail({
        email: 'user@nftopia.io',
        password: 'WrongPassword1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ── email verification ──────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks user email as verified when token is valid', async () => {
      cacheManager.get.mockResolvedValue({ userId: 'user-1', email: 'user@nftopia.io' });
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@nftopia.io',
        isEmailVerified: false,
      });
      userRepository.save.mockResolvedValue({});
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(result.success).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isEmailVerified: true }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith('email-verify:valid-token');
    });

    it('throws BadRequestException for invalid token', async () => {
      cacheManager.get.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ token: 'bad-token' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns success without saving when already verified', async () => {
      cacheManager.get.mockResolvedValue({ userId: 'user-1', email: 'user@nftopia.io' });
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@nftopia.io',
        isEmailVerified: true,
      });
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.verifyEmail({ token: 'already-verified-token' });

      expect(result.success).toBe(true);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  // ── password reset ──────────────────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('sends reset email when user exists with password', async () => {
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockResolvedValue(undefined);
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@nftopia.io',
        passwordHash: 'salt:hash',
        username: 'Alice',
      });

      const result = await service.requestPasswordReset({ email: 'user@nftopia.io' });

      expect(result.success).toBe(true);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('pwd-reset:'),
        expect.objectContaining({ userId: 'user-1' }),
        expect.any(Number),
      );
      expect(emailService.sendAsync).toHaveBeenCalled();
    });

    it('returns success silently when user does not exist (prevents enumeration)', async () => {
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockResolvedValue(undefined);
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.requestPasswordReset({ email: 'unknown@nftopia.io' });

      expect(result.success).toBe(true);
      expect(emailService.sendAsync).not.toHaveBeenCalled();
    });

    it('enforces per-email rate limiting', async () => {
      cacheManager.get.mockResolvedValue({ count: 3, windowStart: Date.now() - 1000 });

      await expect(
        service.requestPasswordReset({ email: 'user@nftopia.io' }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('resetPassword', () => {
    it('updates password when token is valid', async () => {
      cacheManager.get.mockResolvedValue({ userId: 'user-1', email: 'user@nftopia.io' });
      userRepository.findOne.mockResolvedValue({ id: 'user-1', passwordHash: 'old:hash' });
      userRepository.save.mockResolvedValue({});
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewSecure1!',
      });

      expect(result.success).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith('pwd-reset:valid-reset-token');
    });

    it('throws BadRequestException for invalid or expired reset token', async () => {
      cacheManager.get.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'expired-token', newPassword: 'NewSecure1!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
