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
import {
  RedisWalletNonceStore,
  WALLET_NONCE_STORE,
} from './wallet-nonce.store';
import { FakeRedisServer } from '../../test/helpers/fake-wallet-nonce-redis';

describe('AuthService', () => {
  let service: AuthService;
  // Shared by every AuthService built in a test, like a real Redis shared by
  // restarted or parallel backend instances.
  let nonceRedis: FakeRedisServer;

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
    sendBidNotificationEmail: jest.fn(),
    sendAuctionWonEmail: jest.fn(),
  };

  /** A fresh AuthService (new process state) on the shared nonce Redis. */
  async function buildService(): Promise<AuthService> {
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
        {
          provide: WALLET_NONCE_STORE,
          useValue: new RedisWalletNonceStore(nonceRedis.createClient()),
        },
      ],
    }).compile();
    return moduleRef.get(AuthService);
  }

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
      (
        callback: (manager: {
          getRepository: (
            entity: unknown,
          ) =>
            | typeof refreshTokenRepository
            | typeof refreshTokenFamilyRepository;
        }) => unknown,
      ) =>
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

    nonceRedis = new FakeRedisServer();
    service = await buildService();
  });

  const WALLET = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

  /** Repository mocks for a first-time wallet login that creates a user. */
  function mockNewWalletUser() {
    userWalletRepository.findOne.mockResolvedValue(null);
    userRepository.findOne.mockResolvedValue(null);
    const createdUser = {
      address: WALLET,
      walletAddress: WALLET,
      walletProvider: 'freighter',
      walletConnectedAt: new Date(),
    };
    userRepository.create.mockReturnValue(createdUser);
    userRepository.save.mockResolvedValue({
      id: 'user-1',
      ...createdUser,
      username: null,
    });
    userRepository.update.mockResolvedValue(undefined);
    userWalletRepository.update.mockResolvedValue(undefined);
    userWalletRepository.create.mockImplementation(
      (value: Record<string, unknown>) => value,
    );
    userWalletRepository.save.mockImplementation(
      (value: Record<string, unknown>) =>
        Promise.resolve({ id: 'wallet-1', ...value }),
    );
    jwtService.sign.mockReturnValue('signed-token');
  }

  async function issueChallenge(on: AuthService = service) {
    return on.generateWalletChallenge(
      { walletAddress: WALLET, walletProvider: 'freighter' },
      '127.0.0.1',
    );
  }

  function verify(on: AuthService, nonce: string) {
    return on.verifyWalletChallenge({
      walletAddress: WALLET,
      nonce,
      signature: Buffer.from('signed').toString('base64'),
    });
  }

  function pendingChallenge() {
    return new RedisWalletNonceStore(nonceRedis.createClient()).find(WALLET);
  }

  it('generates a wallet challenge session stored in Redis', async () => {
    stellarStrategy.isValidPublicKey.mockReturnValue(true);

    const result = await issueChallenge();

    expect(result.sessionId).toContain('nonce:');
    expect(result.walletAddress).toEqual(WALLET);
    expect(result.nonce).toBeTruthy();
    expect(result.message).toContain('NFTopia Wallet Authentication');

    const stored = await pendingChallenge();
    expect(stored?.nonce).toEqual(result.nonce);
    expect(stored?.challengeMessage).toEqual(result.message);
    // challenge window (300s default) plus the 60s "expired" grace period
    expect(nonceRedis.ttlSeconds(`wallet-auth:nonce:${WALLET}`)).toBe(360);
  });

  it('rejects invalid signatures and keeps the challenge usable', async () => {
    stellarStrategy.isValidPublicKey.mockReturnValue(true);
    stellarStrategy.verifySignedMessage.mockReturnValue(false);
    const { nonce } = await issueChallenge();

    await expect(verify(service, nonce)).rejects.toThrow(
      'Invalid wallet signature',
    );
    expect((await pendingChallenge())?.nonce).toEqual(nonce);
  });

  it('rejects a nonce that does not match the pending challenge', async () => {
    stellarStrategy.isValidPublicKey.mockReturnValue(true);
    stellarStrategy.verifySignedMessage.mockReturnValue(true);
    await issueChallenge();

    await expect(verify(service, 'not-the-nonce')).rejects.toThrow(
      'Invalid nonce',
    );
  });

  it('verifies wallet challenge and returns token pair', async () => {
    stellarStrategy.isValidPublicKey.mockReturnValue(true);
    stellarStrategy.verifySignedMessage.mockReturnValue(true);
    mockNewWalletUser();
    jwtService.sign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');
    const { nonce, message } = await issueChallenge();

    const result = await verify(service, nonce);

    if ('requiresTwoFactor' in result) {
      throw new Error('expected direct auth response, got 2FA challenge');
    }
    expect(result.access_token).toEqual('access-token');
    expect(result.refresh_token).toEqual('refresh-token');
    expect(result.user.id).toEqual('user-1');
    expect(result.user.walletAddress).toEqual(WALLET);
    expect(stellarStrategy.verifySignedMessage).toHaveBeenCalledWith(
      WALLET,
      message,
      expect.any(String),
    );
    expect(await pendingChallenge()).toBeNull();
  });

  describe('wallet nonce storage (#572)', () => {
    beforeEach(() => {
      stellarStrategy.isValidPublicKey.mockReturnValue(true);
      stellarStrategy.verifySignedMessage.mockReturnValue(true);
      mockNewWalletUser();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Move the wall clock (Date and the fake Redis TTLs) forward. */
    function advanceClock(ms: number) {
      jest.useFakeTimers({
        doNotFake: [
          'nextTick',
          'setImmediate',
          'queueMicrotask',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
        ],
      });
      jest.setSystemTime(Date.now() + ms);
    }

    it('completes a challenge issued before a backend restart', async () => {
      const { nonce } = await issueChallenge();

      // Restart: all in-process state is gone, Redis is not.
      const restarted = await buildService();

      await expect(verify(restarted, nonce)).resolves.toHaveProperty(
        'access_token',
      );
    });

    it('verifies a nonce on a different instance sharing the same Redis', async () => {
      const instanceA = service;
      const instanceB = await buildService();
      const { nonce } = await issueChallenge(instanceA);

      await expect(verify(instanceB, nonce)).resolves.toHaveProperty(
        'access_token',
      );
      await expect(verify(instanceA, nonce)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired nonce with a clear error', async () => {
      const { nonce } = await issueChallenge();

      advanceClock(301_000);

      await expect(verify(service, nonce)).rejects.toThrow(
        'Wallet challenge has expired. Request a new challenge.',
      );
      expect(await pendingChallenge()).toBeNull();
    });

    it('rejects a nonce whose Redis entry has already expired', async () => {
      const { nonce } = await issueChallenge();

      advanceClock(361_000);

      await expect(verify(service, nonce)).rejects.toThrow(
        'Wallet challenge not found or expired. Request a new challenge.',
      );
    });

    it('does not allow a used nonce to be replayed', async () => {
      const { nonce } = await issueChallenge();

      await verify(service, nonce);

      await expect(verify(service, nonce)).rejects.toThrow(
        'Wallet challenge not found or expired. Request a new challenge.',
      );
      await expect(verify(await buildService(), nonce)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lets only one of two concurrent verifications of a nonce succeed', async () => {
      const { nonce } = await issueChallenge();
      const other = await buildService();

      const results = await Promise.allSettled([
        verify(service, nonce),
        verify(other, nonce),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rejected?.reason).toBeInstanceOf(UnauthorizedException);
    });

    it('invalidates the earlier nonce when a new challenge is issued', async () => {
      const first = await issueChallenge();
      const second = await issueChallenge();

      await expect(verify(service, first.nonce)).rejects.toThrow(
        'Invalid nonce',
      );
      await expect(verify(service, second.nonce)).resolves.toHaveProperty(
        'access_token',
      );
    });
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
  });

  describe('resetPassword', () => {
    it('updates the password hash and deletes the token on success', async () => {
      cacheManager.get.mockResolvedValue({ userId: 'user-1' });
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
      const saveCalls = refreshTokenRepository.save.mock
        .calls as unknown as Array<[RefreshToken]>;
      const savedToken = saveCalls[0]?.[0];
      expect(savedToken?.id).toBe('refresh-row-1');
      expect(savedToken?.usedAt).toBeInstanceOf(Date);

      const createCalls = refreshTokenRepository.create.mock
        .calls as unknown as Array<[RefreshToken]>;
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

      const familySaveCalls = refreshTokenFamilyRepository.save.mock
        .calls as unknown as Array<[RefreshTokenFamily]>;
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
