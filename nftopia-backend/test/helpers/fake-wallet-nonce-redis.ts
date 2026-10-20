import {
  CONSUME_NONCE_SCRIPT,
  WalletNonceRedisClient,
} from '../../src/auth/wallet-nonce.store';
import {
  LoginAttemptRedisClient,
  RECORD_FAILURE_SCRIPT,
} from '../../src/auth/login-attempt.store';

/**
 * In-memory stand-in for a single Redis server, covering only the commands
 * the wallet nonce store and the login attempt store use. Several clients can share one server, which is
 * how the specs model a backend restart or a second instance: the process
 * state (store, client, AuthService) is new, but the Redis data is the same.
 *
 * TTLs follow `now()`, so tests can move time forward without real waits.
 */
export class FakeRedisServer {
  private readonly entries = new Map<
    string,
    { value: string; expiresAtMs: number | null }
  >();
  private clockOffsetMs = 0;

  now(): number {
    return Date.now() + this.clockOffsetMs;
  }

  advance(ms: number): void {
    this.clockOffsetMs += ms;
  }

  ttlSeconds(key: string): number {
    const entry = this.read(key);
    if (!entry) return -2;
    if (entry.expiresAtMs === null) return -1;
    return Math.ceil((entry.expiresAtMs - this.now()) / 1000);
  }

  rawSet(key: string, value: string): void {
    this.entries.set(key, { value, expiresAtMs: null });
  }

  createClient(): WalletNonceRedisClient &
    LoginAttemptRedisClient & { quitCalls: number } {
    const client = {
      quitCalls: 0,
      set: (key: string, value: string, mode: 'EX', seconds: number) => {
        if (mode !== 'EX') {
          throw new Error(`Unsupported SET mode ${String(mode)}`);
        }
        this.entries.set(key, {
          value,
          expiresAtMs: this.now() + seconds * 1000,
        });
        return Promise.resolve('OK');
      },
      get: (key: string) => Promise.resolve(this.read(key)?.value ?? null),
      del: (...keys: string[]) =>
        Promise.resolve(keys.reduce((n, key) => n + this.delete(key), 0)),
      ttl: (key: string) => Promise.resolve(this.ttlSeconds(key)),
      eval: (script: string, numKeys: number, ...args: (string | number)[]) => {
        if (script === RECORD_FAILURE_SCRIPT && numKeys === 3) {
          return Promise.resolve(this.recordFailure(args));
        }
        if (script !== CONSUME_NONCE_SCRIPT || numKeys !== 1) {
          throw new Error('FakeRedisServer does not support this script');
        }
        // Same logic as the Lua script; it runs synchronously here, so it is
        // just as atomic with respect to other fake clients.
        const [key, nonce] = args.map(String);
        const raw = this.read(key)?.value;
        if (!raw) return Promise.resolve(0);
        let record: unknown;
        try {
          record = JSON.parse(raw);
        } catch {
          return Promise.resolve(0);
        }
        if ((record as { nonce?: unknown })?.nonce !== nonce) {
          return Promise.resolve(0);
        }
        this.delete(key);
        return Promise.resolve(1);
      },
      quit: () => {
        client.quitCalls++;
        return Promise.resolve('OK');
      },
    };
    return client;
  }

  /** Same steps as RECORD_FAILURE_SCRIPT, run synchronously (so atomically). */
  private recordFailure(args: (string | number)[]): number[] {
    const [failuresKey, lockKey, levelKey] = args.slice(0, 3).map(String);
    const [maxAttempts, windowSeconds, baseLock, maxLock, levelTtl] = args
      .slice(3)
      .map(Number);

    const failures = this.incr(failuresKey);
    if (failures === 1) this.expire(failuresKey, windowSeconds);
    if (failures < maxAttempts) return [failures, 0, 0];

    this.delete(failuresKey);
    const level = this.incr(levelKey);
    this.expire(levelKey, levelTtl);
    const lock = Math.floor(Math.min(baseLock * 2 ** (level - 1), maxLock));
    this.entries.set(lockKey, {
      value: String(level),
      expiresAtMs: this.now() + lock * 1000,
    });
    return [failures, lock, level];
  }

  /** INCR keeps an existing TTL, like Redis. */
  private incr(key: string): number {
    const entry = this.read(key);
    const next = Number(entry?.value ?? 0) + 1;
    this.entries.set(key, {
      value: String(next),
      expiresAtMs: entry?.expiresAtMs ?? null,
    });
    return next;
  }

  private expire(key: string, seconds: number): void {
    const entry = this.read(key);
    if (entry) entry.expiresAtMs = this.now() + seconds * 1000;
  }

  private read(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAtMs !== null && entry.expiresAtMs <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private delete(key: string): number {
    return this.read(key) && this.entries.delete(key) ? 1 : 0;
  }
}
