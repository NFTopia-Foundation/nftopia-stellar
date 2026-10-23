import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const STATE_KEY_PREFIX = '2fa_throttle:';

interface ThrottleState {
  /** Consecutive failed attempts since the last success or lockout. */
  failureCount: number;
  /** How many times this key has been locked out back-to-back — drives the escalating backoff. */
  lockoutCount: number;
  /** Epoch ms the current lockout (if any) expires at. */
  lockedUntil: number | null;
}

const EMPTY_STATE: ThrottleState = {
  failureCount: 0,
  lockoutCount: 0,
  lockedUntil: null,
};

/**
 * Brute-force protection shared by every 2FA code-verification path (#647):
 * `verifyAndEnable`, `disableWithTotp`, `disableWithBackupCode`,
 * `regenerateBackupCodes`, `revokeBackupCodes` (authenticated, keyed by
 * `user.id`) and `verifyTwoFactorChallenge`/`verifyRecoveryChallenge`
 * (pre-full-auth, also keyed by the resolved `user.id` rather than the
 * ephemeral `tempToken` — a token-keyed limit would let an attacker reset
 * their budget just by logging in again with the correct password to mint
 * a fresh token for the same target user).
 *
 * Two independent, complementary mechanisms:
 *
 * 1. A **consecutive-failure counter**, reset to 0 on any success. Once it
 *    reaches `TWO_FACTOR_MAX_ATTEMPTS`, the key is locked out — rejected
 *    outright regardless of whether the next code would have been correct.
 * 2. **Escalating backoff**: each time a key is locked out, the next lockout
 *    (if the behavior recurs) doubles in length, from
 *    `TWO_FACTOR_LOCKOUT_BASE_SECONDS` up to a
 *    `TWO_FACTOR_LOCKOUT_MAX_SECONDS` ceiling. `lockoutCount` — and so the
 *    escalation — naturally resets once a key has gone quiet long enough
 *    for its Redis entry to expire, rather than needing separate decay logic.
 */
@Injectable()
export class TwoFactorThrottleService {
  private readonly logger = new Logger(TwoFactorThrottleService.name);
  private readonly maxAttempts: number;
  private readonly failureWindowSeconds: number;
  private readonly baseLockoutSeconds: number;
  private readonly maxLockoutSeconds: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly config: ConfigService,
  ) {
    this.maxAttempts = Number(this.config.get('TWO_FACTOR_MAX_ATTEMPTS') ?? 5);
    this.failureWindowSeconds = Number(
      this.config.get('TWO_FACTOR_FAILURE_WINDOW_SECONDS') ?? 300,
    );
    this.baseLockoutSeconds = Number(
      this.config.get('TWO_FACTOR_LOCKOUT_BASE_SECONDS') ?? 30,
    );
    this.maxLockoutSeconds = Number(
      this.config.get('TWO_FACTOR_LOCKOUT_MAX_SECONDS') ?? 3600,
    );
  }

  /**
   * Throws a 429 with a distinct `TWO_FACTOR_LOCKED_OUT` code (separate from
   * "the code was wrong") if `key` is currently locked out. Call before
   * attempting verification.
   */
  async assertNotLockedOut(key: string): Promise<void> {
    const state = await this.getState(key);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      const retryAfterSeconds = Math.ceil(
        (state.lockedUntil - Date.now()) / 1000,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'TWO_FACTOR_LOCKED_OUT',
          message: `Too many failed 2FA attempts. Try again in ${retryAfterSeconds}s.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Records a failed verification attempt. Once `TWO_FACTOR_MAX_ATTEMPTS`
   * consecutive failures are reached, locks `key` out for an escalating
   * duration instead of just continuing to count.
   */
  async recordFailure(key: string): Promise<void> {
    const state = await this.getState(key);
    const failureCount = state.failureCount + 1;

    if (failureCount >= this.maxAttempts) {
      const lockoutCount = state.lockoutCount + 1;
      const lockoutSeconds = Math.min(
        this.baseLockoutSeconds * 2 ** (lockoutCount - 1),
        this.maxLockoutSeconds,
      );
      this.logger.warn(
        `2FA lockout triggered for ${key}: ${failureCount} consecutive failures, locked ${lockoutSeconds}s (lockout #${lockoutCount})`,
      );
      await this.setState(
        key,
        {
          failureCount: 0,
          lockoutCount,
          lockedUntil: Date.now() + lockoutSeconds * 1000,
        },
        Math.max(lockoutSeconds, this.failureWindowSeconds),
      );
      return;
    }

    await this.setState(
      key,
      { ...state, failureCount },
      this.failureWindowSeconds,
    );
  }

  /** Clears all failure/lockout state for `key` on a successful verification. */
  async recordSuccess(key: string): Promise<void> {
    await this.cacheManager.del(this.stateKey(key));
  }

  private stateKey(key: string): string {
    return `${STATE_KEY_PREFIX}${key}`;
  }

  private async getState(key: string): Promise<ThrottleState> {
    const state = await this.cacheManager.get<ThrottleState>(
      this.stateKey(key),
    );
    return state ?? EMPTY_STATE;
  }

  private async setState(
    key: string,
    state: ThrottleState,
    ttlSeconds: number,
  ): Promise<void> {
    await this.cacheManager.set(this.stateKey(key), state, ttlSeconds * 1000);
  }
}
