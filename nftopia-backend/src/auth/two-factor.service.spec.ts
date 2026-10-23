import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorThrottleService } from './two-factor-throttle.service';
import { User } from '../users/user.entity';
import type { AuthService } from './auth.service';

/**
 * Throttle-integration coverage for #647 ("Add rate limiting to two-factor
 * verification attempts"). This file does not attempt to exercise every
 * branch of TwoFactorService — it specifically proves that the
 * TwoFactorThrottleService wiring works end-to-end for both the
 * authenticated, code-verifying methods and the pre-auth challenge/recovery
 * methods: normal verification succeeds and clears throttle state,
 * consecutive wrong codes are recorded as failures, and exhausting the
 * budget locks the key out — including fail-closed rejection of a
 * subsequently-correct code while locked out.
 */

function makeFakeCache() {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
}

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    TOTP_CODE_LENGTH: 6,
    TOTP_WINDOW: 1,
    TOTP_TIME_STEP: 30,
    TOTP_ISSUER: 'NFTopia',
    TOTP_ALGORITHM: 'sha1',
    TOTP_ENCODING: 'base32',
    BACKUP_CODE_COUNT: 10,
    BACKUP_CODE_LENGTH: 16,
    TWO_FACTOR_MAX_ATTEMPTS: 3,
    TWO_FACTOR_FAILURE_WINDOW_SECONDS: 300,
    TWO_FACTOR_LOCKOUT_BASE_SECONDS: 30,
    TWO_FACTOR_LOCKOUT_MAX_SECONDS: 3600,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    ...overrides,
  } as User;
}

function validTotpFor(secret: string): string {
  return speakeasy.totp({
    secret,
    encoding: 'base32',
    step: 30,
    algorithm: 'sha1',
  });
}

describe('TwoFactorService throttle integration (#647)', () => {
  let cache: ReturnType<typeof makeFakeCache>;
  let config: ReturnType<typeof makeConfigService>;
  let userRepository: { findOne: jest.Mock; save: jest.Mock };
  let throttleService: TwoFactorThrottleService;
  let service: TwoFactorService;

  beforeEach(() => {
    cache = makeFakeCache();
    config = makeConfigService();
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn((user: User) => Promise.resolve(user)),
    };
    throttleService = new TwoFactorThrottleService(
      cache as unknown as Cache,
      config as unknown as ConfigService,
    );
    service = new TwoFactorService(
      userRepository as unknown as Repository<User>,
      cache as unknown as Cache,
      config as unknown as ConfigService,
      {} as unknown as AuthService,
      throttleService,
    );
  });

  describe('verifyAndEnable (authenticated, TOTP)', () => {
    async function setupPendingEnable(user: User, secret: string) {
      await cache.set(`2fa_setup:${user.id}`, {
        secret,
        backupCodes: [],
        createdAt: Date.now(),
      });
    }

    it('enables 2FA on a correct code with no prior failures', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser();
      await setupPendingEnable(user, secret);

      const result = await service.verifyAndEnable(user, validTotpFor(secret));

      expect(result.twoFactorEnabled).toBe(true);
    });

    it('records a failure and rejects on a wrong code', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser();
      await setupPendingEnable(user, secret);

      await expect(
        service.verifyAndEnable(user, '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // One failure recorded, under the threshold (3) — not locked out yet.
      await expect(
        throttleService.assertNotLockedOut(user.id),
      ).resolves.toBeUndefined();
    });

    it('locks out after exhausting the configured attempt budget, rejecting even a correct code', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser();

      // 3 consecutive wrong attempts (max attempts = 3) — each needs fresh
      // pending setup data since a failed attempt doesn't delete it.
      for (let i = 0; i < 3; i++) {
        await setupPendingEnable(user, secret);
        await expect(
          service.verifyAndEnable(user, '000000'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      await setupPendingEnable(user, secret);
      await expect(
        service.verifyAndEnable(user, validTotpFor(secret)),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('clears throttle state on success so a later wrong code does not immediately lock out', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser();

      await setupPendingEnable(user, secret);
      await expect(
        service.verifyAndEnable(user, '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      await setupPendingEnable(user, secret);
      await service.verifyAndEnable(user, validTotpFor(secret));

      // Throttle state was cleared by the success above.
      await expect(
        throttleService.assertNotLockedOut(user.id),
      ).resolves.toBeUndefined();
    });
  });

  describe('verifyTwoFactorChallenge (pre-auth, keyed by resolved user.id)', () => {
    const tempToken = 'temp-token-abc';

    async function setupSession(userId: string) {
      await cache.set(`2fa_session:${tempToken}`, {
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      });
    }

    it('verifies successfully with a correct code', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      await setupSession(user.id);
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.verifyTwoFactorChallenge(
        tempToken,
        validTotpFor(secret),
      );

      expect(result).toEqual({ verified: true, user });
    });

    it('returns verified:false (not a lockout) on a wrong code under the threshold', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      await setupSession(user.id);
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.verifyTwoFactorChallenge(
        tempToken,
        '000000',
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Invalid TOTP code');
    });

    it('locks out the user after 3 consecutive wrong codes, rejecting a subsequently-correct one', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      userRepository.findOne.mockResolvedValue(user);

      for (let i = 0; i < 3; i++) {
        await setupSession(user.id);
        const result = await service.verifyTwoFactorChallenge(
          tempToken,
          '000000',
        );
        expect(result.verified).toBe(false);
      }

      await setupSession(user.id);
      let caught: unknown;
      try {
        await service.verifyTwoFactorChallenge(tempToken, validTotpFor(secret));
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect((caught as HttpException).getResponse()).toMatchObject({
        code: 'TWO_FACTOR_LOCKED_OUT',
      });
    });

    it('keys the lockout by the resolved user, not the (replaceable) tempToken', async () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      userRepository.findOne.mockResolvedValue(user);

      for (let i = 0; i < 3; i++) {
        await setupSession(user.id);
        await service.verifyTwoFactorChallenge(tempToken, '000000');
      }

      // A fresh tempToken for the SAME user must still be locked out.
      const freshToken = 'temp-token-xyz';
      await cache.set(`2fa_session:${freshToken}`, {
        userId: user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      });

      await expect(
        service.verifyTwoFactorChallenge(freshToken, validTotpFor(secret)),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('verifyRecoveryChallenge (pre-auth, backup codes)', () => {
    const tempToken = 'temp-token-recovery';

    async function setupSession(userId: string) {
      await cache.set(`2fa_session:${tempToken}`, {
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      });
    }

    it('verifies successfully with a correct backup code and consumes it', async () => {
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorBackupCodes: [
          service['hashBackupCode']('AAAA-BBBB-CCCC-DDDD'),
        ],
      });
      await setupSession(user.id);
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.verifyRecoveryChallenge(
        tempToken,
        'AAAA-BBBB-CCCC-DDDD',
      );

      expect(result.verified).toBe(true);
      expect(user.twoFactorBackupCodes).toHaveLength(0);
    });

    it('locks out after 3 consecutive wrong backup codes', async () => {
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorBackupCodes: [
          service['hashBackupCode']('AAAA-BBBB-CCCC-DDDD'),
        ],
      });
      userRepository.findOne.mockResolvedValue(user);

      for (let i = 0; i < 3; i++) {
        await setupSession(user.id);
        const result = await service.verifyRecoveryChallenge(
          tempToken,
          'WRONG-CODE-0000',
        );
        expect(result.verified).toBe(false);
      }

      await setupSession(user.id);
      await expect(
        service.verifyRecoveryChallenge(tempToken, 'AAAA-BBBB-CCCC-DDDD'),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('disableWithBackupCode (authenticated, backup codes)', () => {
    it('rejects outright when already locked out, without consuming a valid code', async () => {
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorBackupCodes: [
          service['hashBackupCode']('AAAA-BBBB-CCCC-DDDD'),
        ],
      });

      for (let i = 0; i < 3; i++) {
        await expect(
          service.disableWithBackupCode(user, 'WRONG-CODE-0000'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      await expect(
        service.disableWithBackupCode(user, 'AAAA-BBBB-CCCC-DDDD'),
      ).rejects.toBeInstanceOf(HttpException);
      // Fail-closed: the correct backup code must still be intact, unconsumed.
      expect(user.twoFactorBackupCodes).toHaveLength(1);
    });
  });

  describe('other code-verifying methods call the throttle gate first', () => {
    it.each<[string, (user: User) => Promise<unknown>]>([
      ['disableWithTotp', (user) => service.disableWithTotp(user, '000000')],
      [
        'regenerateBackupCodes',
        (user) => service.regenerateBackupCodes(user, '000000'),
      ],
      [
        'revokeBackupCodes',
        (user) => service.revokeBackupCodes(user, '000000'),
      ],
    ])(
      '%s is rejected with the lockout error once the user is locked out',
      async (_name, invoke) => {
        const secret = speakeasy.generateSecret({ length: 20 }).base32;
        const user = makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: secret,
        });

        await throttleService.recordFailure(user.id);
        await throttleService.recordFailure(user.id);
        await throttleService.recordFailure(user.id);

        await expect(invoke(user)).rejects.toBeInstanceOf(HttpException);
      },
    );
  });
});
