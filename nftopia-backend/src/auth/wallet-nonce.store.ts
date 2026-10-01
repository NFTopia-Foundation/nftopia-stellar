import { OnModuleDestroy } from '@nestjs/common';

export const WALLET_NONCE_STORE = Symbol('WALLET_NONCE_STORE');

/** Stored wallet-auth challenge, keyed by wallet public key. */
export interface WalletChallengeRecord {
  nonce: string;
  challengeMessage: string;
  walletAddress: string;
  walletProvider?: string;
  issuedAt: string;
  expiresAt: string;
  ipAddress?: string;
}

export interface WalletNonceStore {
  /** Store a challenge, replacing any pending one for the same wallet. */
  issue(record: WalletChallengeRecord, ttlSeconds: number): Promise<void>;
  /** Read the pending challenge for a wallet without consuming it. */
  find(walletAddress: string): Promise<WalletChallengeRecord | null>;
  /**
   * Atomically delete the wallet's challenge if it still carries `nonce`.
   * Returns false when it was already consumed or replaced, so a nonce can
   * only ever complete one login, even across backend instances.
   */
  consume(walletAddress: string, nonce: string): Promise<boolean>;
  /** Drop the wallet's pending challenge, if any. */
  discard(walletAddress: string): Promise<void>;
}

/** The subset of the ioredis client the store relies on. */
export interface WalletNonceRedisClient {
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
  ): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  quit?(): Promise<unknown>;
}

export const WALLET_NONCE_KEY_PREFIX = 'wallet-auth:nonce:';

/**
 * Deletes KEYS[1] only if its stored JSON record carries nonce ARGV[1].
 * Returns 1 when consumed, 0 otherwise. Running it as one script makes the
 * read-compare-delete atomic, which is what stops two concurrent
 * verifications of the same signed challenge from both succeeding.
 */
export const CONSUME_NONCE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local ok, record = pcall(cjson.decode, raw)
if ok and type(record) == 'table' and record.nonce == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
`;

export class RedisWalletNonceStore
  implements WalletNonceStore, OnModuleDestroy
{
  constructor(private readonly redis: WalletNonceRedisClient) {}

  static keyFor(walletAddress: string): string {
    return `${WALLET_NONCE_KEY_PREFIX}${walletAddress}`;
  }

  async issue(
    record: WalletChallengeRecord,
    ttlSeconds: number,
  ): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError('Wallet challenge TTL must be a positive integer');
    }
    await this.redis.set(
      RedisWalletNonceStore.keyFor(record.walletAddress),
      JSON.stringify(record),
      'EX',
      ttlSeconds,
    );
  }

  async find(walletAddress: string): Promise<WalletChallengeRecord | null> {
    const raw = await this.redis.get(
      RedisWalletNonceStore.keyFor(walletAddress),
    );
    if (!raw) return null;

    try {
      const record = JSON.parse(raw) as Partial<WalletChallengeRecord>;
      if (
        typeof record?.nonce !== 'string' ||
        typeof record.challengeMessage !== 'string' ||
        typeof record.expiresAt !== 'string'
      ) {
        return null;
      }
      return record as WalletChallengeRecord;
    } catch {
      // A corrupt entry can never be verified; treat it as absent.
      return null;
    }
  }

  async consume(walletAddress: string, nonce: string): Promise<boolean> {
    const result = await this.redis.eval(
      CONSUME_NONCE_SCRIPT,
      1,
      RedisWalletNonceStore.keyFor(walletAddress),
      nonce,
    );
    return Number(result) === 1;
  }

  async discard(walletAddress: string): Promise<void> {
    await this.redis.del(RedisWalletNonceStore.keyFor(walletAddress));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit?.();
  }
}
