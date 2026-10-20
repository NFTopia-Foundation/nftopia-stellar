import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrometheusService } from '../common/metrics/prometheus';
import { LOGIN_ATTEMPT_STORE } from './login-attempt.store';
import type { FailurePolicy, LoginAttemptStore } from './login-attempt.store';

export const LOGIN_LOCKOUT_POLICY = Symbol('LOGIN_LOCKOUT_POLICY');

export interface LoginLockoutPolicy {
  /** Applied per submitted email address. */
  account: FailurePolicy;
  /** Applied per source IP; null disables the IP counter. */
  ip: FailurePolicy | null;
  /** Escalation level at which a lockout is logged as an alert. */
  alertLevel: number;
}

const DEFAULTS = {
  LOGIN_LOCKOUT_MAX_ATTEMPTS: 5,
  LOGIN_LOCKOUT_WINDOW_SECONDS: 900,
  LOGIN_LOCKOUT_BASE_SECONDS: 60,
  LOGIN_LOCKOUT_MAX_SECONDS: 3600,
  LOGIN_LOCKOUT_LEVEL_RESET_SECONDS: 86400,
  // Off by default: req.ip is only the client address when `trust proxy` is
  // set, and behind a load balancer one shared counter would lock everyone.
  LOGIN_LOCKOUT_IP_MAX_ATTEMPTS: 0,
  LOGIN_LOCKOUT_ALERT_LEVEL: 3,
} as const;

type PolicyKey = keyof typeof DEFAULTS;

/**
 * Builds the policy from env-style settings. Missing or invalid values fall
 * back to the defaults above. The per-IP counter is on only when
 * `LOGIN_LOCKOUT_IP_MAX_ATTEMPTS` is a positive number.
 */
export function loginLockoutPolicyFrom(
  get: (key: PolicyKey) => string | undefined,
  logger?: Pick<Logger, 'warn'>,
): LoginLockoutPolicy {
  const read = (key: PolicyKey, allowZero = false): number => {
    const raw = get(key);
    if (raw === undefined || raw === '') return DEFAULTS[key];
    const value = Number(raw);
    if (Number.isInteger(value) && (value > 0 || (allowZero && value === 0))) {
      return value;
    }
    logger?.warn(`Ignoring invalid ${key}="${raw}"; using ${DEFAULTS[key]}`);
    return DEFAULTS[key];
  };

  const baseLockSeconds = read('LOGIN_LOCKOUT_BASE_SECONDS');
  const shared = {
    windowSeconds: read('LOGIN_LOCKOUT_WINDOW_SECONDS'),
    baseLockSeconds,
    maxLockSeconds: Math.max(
      baseLockSeconds,
      read('LOGIN_LOCKOUT_MAX_SECONDS'),
    ),
    levelTtlSeconds: read('LOGIN_LOCKOUT_LEVEL_RESET_SECONDS'),
  };
  const ipMaxAttempts = read('LOGIN_LOCKOUT_IP_MAX_ATTEMPTS', true);

  return {
    account: { ...shared, maxAttempts: read('LOGIN_LOCKOUT_MAX_ATTEMPTS') },
    ip: ipMaxAttempts > 0 ? { ...shared, maxAttempts: ipMaxAttempts } : null,
    alertLevel: read('LOGIN_LOCKOUT_ALERT_LEVEL'),
  };
}

/**
 * Rejection for a locked login. The message and code are the same whether the
 * account exists, the password was right, or the lock came from the IP, so it
 * can't be used to enumerate accounts.
 */
export class LoginLockedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        message: 'Too many failed sign-in attempts. Please try again later.',
        code: 'LOGIN_TEMPORARILY_LOCKED',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Short, non-reversible reference for an email, for Redis keys and logs. */
export function accountRef(normalizedEmail: string): string {
  return crypto
    .createHash('sha256')
    .update(normalizedEmail)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Brute-force protection for email/password login (#648).
 *
 * Failures are counted per submitted email, whether or not an account exists,
 * and optionally per source IP. Reaching the threshold locks that subject for an
 * escalating period. While locked, the password isn't checked at all, so a
 * correct guess during a lockout looks exactly like a wrong one.
 *
 * If Redis is unreachable, login is allowed (fail open) and the error is
 * logged and counted: an outage in the counter store shouldn't take sign-in
 * down for everyone.
 */
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);

  constructor(
    @Inject(LOGIN_ATTEMPT_STORE) private readonly store: LoginAttemptStore,
    @Inject(LOGIN_LOCKOUT_POLICY) private readonly policy: LoginLockoutPolicy,
    private readonly prometheus: PrometheusService,
  ) {}

  /** Throws `LoginLockedException` if the email or the IP is locked. */
  async assertNotLocked(normalizedEmail: string, ip?: string): Promise<void> {
    let remaining = 0;
    try {
      remaining = await this.store.lockedFor(
        this.subjects(normalizedEmail, ip),
      );
    } catch (error) {
      this.storeUnavailable('check', error);
      return;
    }
    if (remaining > 0) {
      this.prometheus.incrementLoginLockedRejection();
      throw new LoginLockedException(remaining);
    }
  }

  /** Records a failed attempt; locks and logs when a threshold is reached. */
  async registerFailure(
    normalizedEmail: string,
    ip?: string,
    userId?: string,
  ): Promise<void> {
    const ref = accountRef(normalizedEmail);
    this.prometheus.incrementLoginFailure();
    try {
      const account = await this.store.recordFailure(
        `acct:${ref}`,
        this.policy.account,
      );
      if (account.lockedSeconds > 0) {
        this.lockedOut('account', account.level, account.lockedSeconds, {
          accountRef: ref,
          userId: userId ?? null,
          ip: ip ?? null,
          failures: account.failures,
        });
      }

      if (ip && this.policy.ip) {
        const source = await this.store.recordFailure(
          `ip:${ip}`,
          this.policy.ip,
        );
        if (source.lockedSeconds > 0) {
          this.lockedOut('ip', source.level, source.lockedSeconds, {
            ip,
            lastAccountRef: ref,
            failures: source.failures,
          });
        }
      }
    } catch (error) {
      this.storeUnavailable('record', error);
    }
  }

  /** Clears the account's failures after a successful password check. */
  async registerSuccess(normalizedEmail: string): Promise<void> {
    try {
      await this.store.reset(`acct:${accountRef(normalizedEmail)}`);
    } catch (error) {
      this.storeUnavailable('reset', error);
    }
  }

  private subjects(normalizedEmail: string, ip?: string): string[] {
    const subjects = [`acct:${accountRef(normalizedEmail)}`];
    if (ip && this.policy.ip) subjects.push(`ip:${ip}`);
    return subjects;
  }

  private lockedOut(
    scope: 'account' | 'ip',
    level: number,
    lockedSeconds: number,
    details: Record<string, unknown>,
  ) {
    this.prometheus.incrementLoginLockout(scope);
    const event = JSON.stringify({
      event: 'login_lockout',
      scope,
      level,
      lockedSeconds,
      ...details,
    });
    // Repeated lockouts within the level window point at a sustained attack
    // on one account or from one source, which is worth paging on.
    if (level >= this.policy.alertLevel) {
      this.logger.error(`ALERT sustained failed-login pressure: ${event}`);
    } else {
      this.logger.warn(`Login lockout: ${event}`);
    }
  }

  private storeUnavailable(operation: string, error: unknown) {
    this.prometheus.incrementLoginLockoutStoreError(operation);
    this.logger.error(
      `Login lockout store unavailable during ${operation}; allowing login: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
