import { FakeRedisServer } from '../../test/helpers/fake-wallet-nonce-redis';
import {
  RedisWalletNonceStore,
  WalletChallengeRecord,
} from './wallet-nonce.store';

const WALLET = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function challenge(
  overrides: Partial<WalletChallengeRecord> = {},
): WalletChallengeRecord {
  return {
    nonce: 'nonce-1',
    challengeMessage: 'sign me',
    walletAddress: WALLET,
    walletProvider: 'freighter',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    ...overrides,
  };
}

describe('RedisWalletNonceStore', () => {
  let server: FakeRedisServer;
  let store: RedisWalletNonceStore;

  beforeEach(() => {
    server = new FakeRedisServer();
    store = new RedisWalletNonceStore(server.createClient());
  });

  it('stores a challenge under a namespaced key with the given TTL', async () => {
    const record = challenge();
    await store.issue(record, 360);

    expect(await store.find(WALLET)).toEqual(record);
    expect(server.ttlSeconds(`wallet-auth:nonce:${WALLET}`)).toBe(360);
  });

  it('rejects a non-positive or fractional TTL', async () => {
    for (const ttl of [0, -1, 1.5, Number.NaN]) {
      await expect(store.issue(challenge(), ttl)).rejects.toThrow(RangeError);
    }
  });

  it('drops the challenge once its TTL elapses', async () => {
    await store.issue(challenge(), 10);

    server.advance(9_000);
    expect(await store.find(WALLET)).not.toBeNull();

    server.advance(1_000);
    expect(await store.find(WALLET)).toBeNull();
    expect(await store.consume(WALLET, 'nonce-1')).toBe(false);
  });

  it('consumes a nonce exactly once', async () => {
    await store.issue(challenge(), 60);

    expect(await store.consume(WALLET, 'nonce-1')).toBe(true);
    expect(await store.consume(WALLET, 'nonce-1')).toBe(false);
    expect(await store.find(WALLET)).toBeNull();
  });

  it('does not consume or delete when the nonce does not match', async () => {
    await store.issue(challenge(), 60);

    expect(await store.consume(WALLET, 'other-nonce')).toBe(false);
    expect((await store.find(WALLET))?.nonce).toBe('nonce-1');
  });

  it('a new challenge replaces the pending one', async () => {
    await store.issue(challenge(), 60);
    await store.issue(challenge({ nonce: 'nonce-2' }), 60);

    expect(await store.consume(WALLET, 'nonce-1')).toBe(false);
    expect(await store.consume(WALLET, 'nonce-2')).toBe(true);
  });

  it('shares challenges across store instances on the same Redis', async () => {
    await store.issue(challenge(), 60);

    // A restarted process, or a second instance, gets a fresh client.
    const other = new RedisWalletNonceStore(server.createClient());

    expect((await other.find(WALLET))?.nonce).toBe('nonce-1');
    expect(await other.consume(WALLET, 'nonce-1')).toBe(true);
    expect(await store.consume(WALLET, 'nonce-1')).toBe(false);
  });

  it('treats corrupt or incomplete entries as absent', async () => {
    const key = RedisWalletNonceStore.keyFor(WALLET);

    server.rawSet(key, '{not json');
    expect(await store.find(WALLET)).toBeNull();

    server.rawSet(key, JSON.stringify({ nonce: 'nonce-1' }));
    expect(await store.find(WALLET)).toBeNull();
  });

  it('discard removes the pending challenge', async () => {
    await store.issue(challenge(), 60);
    await store.discard(WALLET);

    expect(await store.find(WALLET)).toBeNull();
  });

  it('closes the Redis connection on module destroy', async () => {
    const client = server.createClient();
    await new RedisWalletNonceStore(client).onModuleDestroy();

    expect(client.quitCalls).toBe(1);
  });
});
