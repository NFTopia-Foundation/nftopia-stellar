import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserWallet } from './entities/user-wallet.entity';
import { WalletSession } from './entities/wallet-session.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenFamily } from './entities/refresh-token-family.entity';
import { DataSource } from 'typeorm';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';
import { TwoFactorService } from './two-factor.service';
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

  const refreshTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const refreshTokenFamilyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
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

  const twoFactorService = {
    createTwoFactorSession: jest.fn(),
  };

  const emailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
    sendBidNotificationEmail: jest.fn(),
    sendAuctionWonEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    refreshTokenFamilyRepository.create.mockImplementation(
      (value: Partial<RefreshTokenFamily>) => value,
    );
    refreshTokenFamilyRepository.save.mockImplementation(
      (value: Partial<RefreshTokenFamily>) => ({
        id: value.id ?? 'family-1',
        ...value,
      }),
    );
    refreshTokenRepository.create.mockImplementation(
      (value: Partial<RefreshToken>) => value,
    );
    refreshTokenRepository.save.mockImplementation(
      (value: Partial<RefreshToken>) => value,
    );
    dataSource.transaction.mockImplementation(
      (callback: (manager: {
        getRepository: (
          entity: unknown,
        ) =>
          | typeof refreshTokenRepository
          | typeof refreshTokenFamilyRepository;
      }) => unknown) =>
        Promise.resolve(
          callback({
            getRepository: (entity: unknown) => {
              if (entity === RefreshToken) return refreshTokenRepository;
              if (entity === RefreshTokenFamily)
                return refreshTokenFamilyRepository;
              throw new Error('Unexpected transactional repository');
            },
          }),
        ),
    );

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
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: getRepositoryToken(RefreshTokenFamily),
          useValue: refreshTokenFamilyRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: TwoFactorService,
          useValue: twoFactorService,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

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

    // Mock cacheManager.get to return session data
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

    if ('requiresTwoFactor' in result) {
      throw new Error('expected direct auth response, got 2FA challenge');
    }
    expect(result.access_token).toEqual('access-token');
    expect(result.refresh_token).toEqual('refresh-token');
    expect(result.user.id).toEqual('user-1');
    expect(result.user.walletAddress).toEqual(walletAddress);
    expect(cacheManager.get).toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalled();
  });

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
    // buildAuthResponse calls buildTokenPair which calls jwtService.sign twice
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
      { userId: 'user-email-1' },
      expect.any(Number),
    );
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      'user@nftopia.io',
      expect.any(String),
      'user1',
    );
  });

  it('registration still succeeds when sending the verification email fails', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.create.mockReturnValue({
      email: 'user@nftopia.io',
      username: 'user1',
      passwordHash: 'salt:hash',
    });
    userRepository.save.mockResolvedValue({
      id: 'user-email-2',
      email: 'user@nftopia.io',
      username: 'user1',
      isEmailVerified: false,
    });
    jwtService.sign
      .mockReturnValueOnce('access-token-email')
      .mockReturnValueOnce('refresh-token-email');
    emailService.sendVerificationEmail.mockRejectedValueOnce(
      new Error('smtp down'),
    );

    const result = await service.registerWithEmail({
      email: 'user@nftopia.io',
      password: 'A_secure1!',
      username: 'user1',
    });

    expect(result.access_token).toBe('access-token-email');
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

  it('includes the user role claim in the access token and auth response', async () => {
    jwtService.sign
      .mockReturnValueOnce('access-token-admin')
      .mockReturnValueOnce('refresh-token-admin');

    const result = await service.buildAuthResponse({
      id: 'admin-1',
      email: 'admin@nftopia.io',
      username: 'admin',
      role: UserRole.ADMIN,
    } as User);

    expect(jwtService.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: 'admin-1',
        role: UserRole.ADMIN,
        type: 'access',
      }),
    );
    expect(result.user.role).toBe(UserRole.ADMIN);
  });

  describe('verifyEmail', () => {
    it('marks the user verified and deletes the token on success', async () => {
      cacheManager.get.mockResolvedValue({ userId: 'user-1' });
      userRepository.update.mockResolvedValue(undefined);
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.verifyEmail({ token: 'raw-token' });

      expect(result).toEqual({ success: true });
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { isEmailVerified: true },
      );
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('rejects an invalid or expired token', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      await expect(
        service.verifyEmail({ token: 'bad-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('requestPasswordReset', () => {
    it('generates a token and emails the user when the account exists', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@nftopia.io',
        passwordHash: 'existing-password-hash',
        username: 'user1',
      });
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.requestPasswordReset({
        email: 'user@nftopia.io',
      });

      expect(result).toEqual({ success: true });
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('password-reset:'),
        { userId: 'user-1' },
        expect.any(Number),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@nftopia.io',
        expect.any(String),
        'user1',
      );
    });

    it('returns success without sending an email when the account does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.requestPasswordReset({
        email: 'nobody@nftopia.io',
      });

      expect(result).toEqual({ success: true });
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('directs wallet-only accounts to wallet authentication', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'wallet-user',
        email: 'wallet@nftopia.io',
        passwordHash: null,
      });

      await expect(
        service.requestPasswordReset({ email: 'wallet@nftopia.io' }),
      ).rejects.toThrow('Sign in with your Stellar wallet');

      expect(cacheManager.set).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password hash and deletes the token on success', async () => {
      cacheManager.get.mockResolvedValue({ userId: 'user-1' });
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@nftopia.io',
        username: 'user1',
      });
      userRepository.update.mockResolvedValue(undefined);
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.resetPassword({
        token: 'raw-token',
        newPassword: 'New_secure1!',
      });

      expect(result).toEqual({ success: true });
      const [criteria, update] = userRepository.update.mock.calls[0] as [
        { id: string },
        { passwordHash: string },
      ];
      expect(criteria).toEqual({ id: 'user-1' });
      expect(typeof update.passwordHash).toBe('string');
      expect(cacheManager.del).toHaveBeenCalled();
      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'user@nftopia.io',
        'user1',
      );
    });

    it('rejects an invalid or expired token', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'New_secure1!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
  describe('refreshTokens', () => {
    const user = {
      id: 'user-refresh-1',
      email: 'refresh@nftopia.io',
      username: 'refresh-user',
      walletAddress: null,
      address: null,
    };

    beforeEach(() => {
      userRepository.findOne.mockResolvedValue(user);
    });

    it('rotates a refresh token and records the old token as used', async () => {
      const oldToken = 'refresh-token-1';
      const newToken = 'refresh-token-2';

      jwtService.verify.mockReturnValue({
        sub: user.id,
        type: 'refresh',
        jti: 'jti-1',
        familyId: 'family-1',
      });
      jwtService.sign
        .mockReturnValueOnce('access-token-2')
        .mockReturnValueOnce(newToken);

      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'refresh-row-1',
        jti: 'jti-1',
        familyId: 'family-1',
        userId: user.id,
        tokenHash: service['hashToken'](oldToken),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        revokedAt: null,
      });
      refreshTokenFamilyRepository.findOne.mockResolvedValue({
        id: 'family-1',
        userId: user.id,
        revokedAt: null,
      });

      const result = await service.refreshTokens(oldToken);

      expect(result).toEqual({
        access_token: 'access-token-2',
        refresh_token: newToken,
      });
      const saveCalls = refreshTokenRepository.save.mock.calls as unknown as
        Array<[RefreshToken]>;
      const savedToken = saveCalls[0]?.[0];
      expect(savedToken?.id).toBe('refresh-row-1');
      expect(savedToken?.usedAt).toBeInstanceOf(Date);

      const createCalls = refreshTokenRepository.create.mock.calls as unknown as
        Array<[RefreshToken]>;
      const createdToken = createCalls[0]?.[0];
      expect(createdToken?.familyId).toBe('family-1');
      expect(createdToken?.userId).toBe(user.id);
      expect(createdToken?.jti).toEqual(expect.any(String));
      expect(createdToken?.tokenHash).toBe(service['hashToken'](newToken));
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const reusedToken = 'refresh-token-reused';

      jwtService.verify.mockReturnValue({
        sub: user.id,
        type: 'refresh',
        jti: 'jti-used',
        familyId: 'family-1',
      });

      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'refresh-row-used',
        jti: 'jti-used',
        familyId: 'family-1',
        userId: user.id,
        tokenHash: service['hashToken'](reusedToken),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(Date.now() - 1_000),
        revokedAt: null,
      });
      const family = {
        id: 'family-1',
        userId: user.id,
        revokedAt: null,
      };
      refreshTokenFamilyRepository.findOne.mockResolvedValue(family);

      await expect(service.refreshTokens(reusedToken)).rejects.toThrow(
        'Refresh token reuse detected',
      );

      const familySaveCalls =
        refreshTokenFamilyRepository.save.mock.calls as unknown as
          Array<[RefreshTokenFamily]>;
      const revokedFamily = familySaveCalls[0]?.[0];
      expect(revokedFamily?.id).toBe('family-1');
      expect(revokedFamily?.revokedAt).toBeInstanceOf(Date);
      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an already revoked family', async () => {
      const token = 'refresh-token-revoked-family';

      jwtService.verify.mockReturnValue({
        sub: user.id,
        type: 'refresh',
        jti: 'jti-revoked',
        familyId: 'family-1',
      });
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'refresh-row-revoked',
        jti: 'jti-revoked',
        familyId: 'family-1',
        userId: user.id,
        tokenHash: service['hashToken'](token),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        revokedAt: null,
      });
      refreshTokenFamilyRepository.findOne.mockResolvedValue({
        id: 'family-1',
        userId: user.id,
        revokedAt: new Date(),
      });

      await expect(service.refreshTokens(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an expired refresh token without rotating it', async () => {
      const token = 'refresh-token-expired';

      jwtService.verify.mockReturnValue({
        sub: user.id,
        type: 'refresh',
        jti: 'jti-expired',
        familyId: 'family-1',
      });
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'refresh-row-expired',
        jti: 'jti-expired',
        familyId: 'family-1',
        userId: user.id,
        tokenHash: service['hashToken'](token),
        expiresAt: new Date(Date.now() - 1_000),
        usedAt: null,
        revokedAt: null,
      });
      refreshTokenFamilyRepository.findOne.mockResolvedValue({
        id: 'family-1',
        userId: user.id,
        revokedAt: null,
      });

      await expect(service.refreshTokens(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });
  });

});
