import { FakeRedisServer } from '../../test/helpers/fake-wallet-nonce-redis';
import {
  RedisLoginAttemptStore,
  loginAttemptKeys,
  type FailurePolicy,
} from './login-attempt.store';
import { accountRef, loginLockoutPolicyFrom } from './login-lockout.service';

const POLICY: FailurePolicy = {
  maxAttempts: 3,
  windowSeconds: 600,
  baseLockSeconds: 30,
  maxLockSeconds: 300,
  levelTtlSeconds: 3600,
};

describe('RedisLoginAttemptStore', () => {
  let redis: FakeRedisServer;
  let store: RedisLoginAttemptStore;

  beforeEach(() => {
    redis = new FakeRedisServer();
    store = new RedisLoginAttemptStore(redis.createClient());
  });

  it('counts failures and locks on the threshold', async () => {
    expect(await store.recordFailure('acct:x', POLICY)).toEqual({
      failures: 1,
      lockedSeconds: 0,
      level: 0,
    });
    await store.recordFailure('acct:x', POLICY);
    expect(await store.recordFailure('acct:x', POLICY)).toEqual({
      failures: 3,
      lockedSeconds: 30,
      level: 1,
    });
    expect(await store.lockedFor(['acct:x'])).toBe(30);
    // The failure count restarts once a lock is set.
    expect(redis.ttlSeconds(loginAttemptKeys('acct:x').failures)).toBe(-2);
  });

  it('forgets failures when the window passes', async () => {
    await store.recordFailure('acct:x', POLICY);
    await store.recordFailure('acct:x', POLICY);
    redis.advance(601_000);
    expect((await store.recordFailure('acct:x', POLICY)).failures).toBe(1);
  });

  it('reports the longest lock among subjects', async () => {
    for (let i = 0; i < 3; i++) await store.recordFailure('acct:a', POLICY);
    for (let i = 0; i < 3; i++) {
      await store.recordFailure('ip:1', { ...POLICY, baseLockSeconds: 90 });
    }
    expect(await store.lockedFor(['acct:a', 'ip:1', 'acct:none'])).toBe(90);
    expect(await store.lockedFor(['acct:none'])).toBe(0);
  });

  it('reset clears failures and escalation', async () => {
    for (let i = 0; i < 3; i++) await store.recordFailure('acct:x', POLICY);
    redis.advance(31_000);
    await store.reset('acct:x');
    for (let i = 0; i < 3; i++) await store.recordFailure('acct:x', POLICY);
    // Back to the base lock rather than the doubled one.
    expect(await store.lockedFor(['acct:x'])).toBe(30);
  });

  it('rejects a policy that would never lock or never expire', async () => {
    await expect(
      store.recordFailure('acct:x', { ...POLICY, maxAttempts: 0 }),
    ).rejects.toThrow(RangeError);
    await expect(
      store.recordFailure('acct:x', { ...POLICY, baseLockSeconds: 1.5 }),
    ).rejects.toThrow(RangeError);
  });
});

describe('loginLockoutPolicyFrom', () => {
  it('uses the defaults, with the per-IP counter off', () => {
    const policy = loginLockoutPolicyFrom(() => undefined);
    expect(policy.account).toEqual({
      maxAttempts: 5,
      windowSeconds: 900,
      baseLockSeconds: 60,
      maxLockSeconds: 3600,
      levelTtlSeconds: 86400,
    });
    expect(policy.ip).toBeNull();
    expect(policy.alertLevel).toBe(3);
  });

  it('reads overrides and enables the IP counter when set', () => {
    const env: Record<string, string> = {
      LOGIN_LOCKOUT_MAX_ATTEMPTS: '3',
      LOGIN_LOCKOUT_IP_MAX_ATTEMPTS: '40',
      LOGIN_LOCKOUT_BASE_SECONDS: '120',
      LOGIN_LOCKOUT_MAX_SECONDS: '60',
    };
    const policy = loginLockoutPolicyFrom((key) => env[key]);
    expect(policy.account.maxAttempts).toBe(3);
    expect(policy.ip?.maxAttempts).toBe(40);
    // The cap is never below the first lock.
    expect(policy.account.maxLockSeconds).toBe(120);
  });

  it('falls back to defaults on invalid values and says so', () => {
    const warn = jest.fn();
    const policy = loginLockoutPolicyFrom(
      (key) => (key === 'LOGIN_LOCKOUT_MAX_ATTEMPTS' ? 'lots' : '-1'),
      { warn },
    );
    expect(policy.account.maxAttempts).toBe(5);
    expect(policy.account.windowSeconds).toBe(900);
    expect(policy.ip).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('LOGIN_LOCKOUT_MAX_ATTEMPTS="lots"'),
    );
  });

  it('derives a stable, non-reversible account reference', () => {
    expect(accountRef('a@b.io')).toBe(accountRef('a@b.io'));
    expect(accountRef('a@b.io')).toMatch(/^[0-9a-f]{16}$/);
    expect(accountRef('a@b.io')).not.toBe(accountRef('c@b.io'));
  });
});
