// ── Mocks (must be hoisted before imports) ───────────────────────────────────
// A real SHA-256 (via Node's `crypto`, available under the jest node
// environment) rather than a naive hex-encode — the encryption round-trip
// tests below rely on the digest's avalanche property (different secrets
// must not share a keystream prefix), which a naive stub wouldn't have.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn().mockImplementation((_algo: string, input: string) =>
      Promise.resolve(nodeCrypto.createHash('sha256').update(input).digest('hex')),
    ),
  };
});

const secureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 'whenUnlocked',
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStore[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(secureStore[key] ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    delete secureStore[key];
    return Promise.resolve();
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { createEncryptedStorage } from './persistence.utils';

describe('createEncryptedStorage', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) delete secureStore[key];
  });

  it('round-trips a value through encryption', async () => {
    const storage = createEncryptedStorage('test-secret');
    await storage.setItem('k', JSON.stringify({ foo: 'bar', n: 42 }));

    const result = await storage.getItem('k');
    expect(JSON.parse(result as string)).toEqual({ foo: 'bar', n: 42 });
  });

  it('does not store the plaintext value directly', async () => {
    const storage = createEncryptedStorage('test-secret');
    const plaintext = JSON.stringify({ secret: 'do-not-leak-me' });
    await storage.setItem('k', plaintext);

    expect(secureStore['k']).toBeDefined();
    expect(secureStore['k']).not.toBe(plaintext);
    expect(secureStore['k']).not.toContain('do-not-leak-me');
  });

  it('returns null for a missing key', async () => {
    const storage = createEncryptedStorage('test-secret');
    expect(await storage.getItem('missing')).toBeNull();
  });

  it('removes a stored item', async () => {
    const storage = createEncryptedStorage('test-secret');
    await storage.setItem('k', JSON.stringify({ a: 1 }));
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('falls back to plaintext for data written before encryption was applied (migration)', async () => {
    // Simulates a value written by the old no-op stub, or by
    // `secureStorageAdapter` directly — raw JSON, never encrypted.
    secureStore['k'] = JSON.stringify({ legacy: true });

    const storage = createEncryptedStorage('test-secret');
    const result = await storage.getItem('k');
    expect(JSON.parse(result as string)).toEqual({ legacy: true });
  });

  it("different secrets do not decrypt each other's data", async () => {
    const storageA = createEncryptedStorage('secret-a');
    await storageA.setItem('k', JSON.stringify({ v: 1 }));

    const storageB = createEncryptedStorage('secret-b');
    const result = await storageB.getItem('k');

    // Wrong key: decryption fails validation, and the raw ciphertext isn't
    // valid JSON either, so this must not resolve to the original value.
    let parsed: unknown = null;
    try {
      parsed = result === null ? null : JSON.parse(result);
    } catch {
      parsed = 'unparseable';
    }
    expect(parsed).not.toEqual({ v: 1 });
  });
});
