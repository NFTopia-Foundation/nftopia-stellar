import { OnModuleDestroy } from '@nestjs/common';

export const LOGIN_ATTEMPT_STORE = Symbol('LOGIN_ATTEMPT_STORE');

/** Limits applied when recording a failed login for one subject. */
export interface FailurePolicy {
  /** Failures within the window that trigger a lockout. */
  maxAttempts: number;
  /** How long a run of failures is remembered, in seconds. */
  windowSeconds: number;
  /** First lockout length; each further lockout doubles it. */
  baseLockSeconds: number;
  /** Upper bound for a lockout. */
  maxLockSeconds: number;
  /** How long the escalation level is remembered after the last lockout. */
  levelTtlSeconds: number;
}

export interface FailureResult {
  /** Failures counted in the current window, including this one. */
  failures: number;
  /** Lockout just applied, in seconds; 0 when this failure didn't lock. */
  lockedSeconds: number;
  /** How many lockouts this subject has had within `levelTtlSeconds`. */
  level: number;
}

/**
 * Failed-login counters and lockouts, keyed by an opaque subject such as
 * `acct:<hash>` or `ip:<address>`.
 */
export interface LoginAttemptStore {
  /** Seconds left on the longest active lockout among `subjects`; 0 if none. */
  lockedFor(subjects: string[]): Promise<number>;
  /** Count a failure and lock the subject once it reaches the threshold. */
  recordFailure(subject: string, policy: FailurePolicy): Promise<FailureResult>;
  /** Forget a subject's failures and escalation level (after a good login). */
  reset(subject: string): Promise<void>;
}

/** The subset of the ioredis client the store relies on. */
export interface LoginAttemptRedisClient {
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  quit?(): Promise<unknown>;
}

export const LOGIN_ATTEMPT_KEY_PREFIX = 'login-lockout:';

/**
 * KEYS: failures, lock, level. ARGV: maxAttempts, windowSeconds,
 * baseLockSeconds, maxLockSeconds, levelTtlSeconds.
 *
 * Counts the failure and, at the threshold, clears the count, bumps the
 * escalation level and sets a lock of base * 2^(level-1) seconds (capped).
 * One script so concurrent failures from several instances can't both slip
 * under the threshold. Returns {failures, lockedSeconds, level}.
 */
export const RECORD_FAILURE_SCRIPT = `
local failures = redis.call('INCR', KEYS[1])
if failures == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
if failures < tonumber(ARGV[1]) then
  return {failures, 0, 0}
end
redis.call('DEL', KEYS[1])
local level = redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[5]))
local lock = tonumber(ARGV[3]) * (2 ^ (level - 1))
if lock > tonumber(ARGV[4]) then
  lock = tonumber(ARGV[4])
end
lock = math.floor(lock)
redis.call('SET', KEYS[2], level, 'EX', lock)
return {failures, lock, level}
`;

export function loginAttemptKeys(subject: string) {
  return {
    failures: `${LOGIN_ATTEMPT_KEY_PREFIX}fail:${subject}`,
    lock: `${LOGIN_ATTEMPT_KEY_PREFIX}lock:${subject}`,
    level: `${LOGIN_ATTEMPT_KEY_PREFIX}level:${subject}`,
  };
}

function assertPositiveInteger(name: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

export class RedisLoginAttemptStore
  implements LoginAttemptStore, OnModuleDestroy
{
  constructor(private readonly redis: LoginAttemptRedisClient) {}

  async lockedFor(subjects: string[]): Promise<number> {
    const ttls = await Promise.all(
      subjects.map((subject) => this.redis.ttl(loginAttemptKeys(subject).lock)),
    );
    // TTL is -2 for a missing key and -1 for one without expiry; a lock is
    // always written with EX, so only positive values mean "locked".
    return Math.max(0, ...ttls.map(Number).filter((ttl) => ttl > 0));
  }

  async recordFailure(
    subject: string,
    policy: FailurePolicy,
  ): Promise<FailureResult> {
    assertPositiveInteger('maxAttempts', policy.maxAttempts);
    assertPositiveInteger('windowSeconds', policy.windowSeconds);
    assertPositiveInteger('baseLockSeconds', policy.baseLockSeconds);
    assertPositiveInteger('maxLockSeconds', policy.maxLockSeconds);
    assertPositiveInteger('levelTtlSeconds', policy.levelTtlSeconds);

    const keys = loginAttemptKeys(subject);
    const raw = await this.redis.eval(
      RECORD_FAILURE_SCRIPT,
      3,
      keys.failures,
      keys.lock,
      keys.level,
      policy.maxAttempts,
      policy.windowSeconds,
      policy.baseLockSeconds,
      policy.maxLockSeconds,
      policy.levelTtlSeconds,
    );
    const [failures, lockedSeconds, level] = Array.isArray(raw)
      ? raw.map(Number)
      : [0, 0, 0];
    return { failures, lockedSeconds, level };
  }

  async reset(subject: string): Promise<void> {
    const keys = loginAttemptKeys(subject);
    await this.redis.del(keys.failures, keys.level);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit?.();
  }
}
