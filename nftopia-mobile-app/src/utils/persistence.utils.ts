import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface PersistenceConfig {
  name: string;
  version?: number;
  migrate?: (persistedState: any, version: number) => Promise<any>;
  partialize?: (state: any) => any;
  blacklist?: string[];
  whitelist?: string[];
  storage?: StorageAdapter;
  encrypt?: boolean;
  encryptKeys?: string[];
}

// AsyncStorage adapter
export const asyncStorageAdapter: StorageAdapter = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`[Persistence] Failed to get item ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`[Persistence] Failed to set item ${key}:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[Persistence] Failed to remove item ${key}:`, error);
    }
  },
};

// Secure storage adapter for sensitive data
export const secureStorageAdapter: StorageAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`[Persistence] Failed to get secure item ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } catch (error) {
      console.error(`[Persistence] Failed to set secure item ${key}:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`[Persistence] Failed to remove secure item ${key}:`, error);
    }
  },
};

// Lightweight symmetric cipher used to encrypt data before it's handed to
// SecureStore. XOR-with-a-digested-keystream, not real AES — expo-crypto
// only exposes hashing/digest primitives, not a symmetric cipher, and this
// matches the same tradeoff already made (and documented) for wallet
// secrets in `src/services/stellar/secureStorage.ts`. It still adds a real
// layer on top of SecureStore's own OS-level (Keychain/Keystore) encryption
// at rest, which is what actually matters here: without it, this function
// was a documented no-op (see git history) and stored data in plaintext.
async function deriveKeystream(secret: string, length: number): Promise<string> {
  // Imported lazily so modules that pull in `store.factory.ts` (and so
  // this file) but never actually use `storage: 'encrypted'` don't pay for
  // loading expo-crypto — and, under this project's node-based jest setup,
  // don't need to mock it either.
  const Crypto = await import('expo-crypto');
  let keystream = '';
  let block = secret;
  while (keystream.length < length) {
    block = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, block);
    keystream += block;
  }
  return keystream.slice(0, length);
}

async function xorTransform(text: string, secret: string): Promise<string> {
  const keystream = await deriveKeystream(secret, text.length);
  return text
    .split('')
    .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ keystream.charCodeAt(i)))
    .join('');
}

// Create a storage adapter with encryption
export const createEncryptedStorage = (
  encryptionKey: string
): StorageAdapter => {
  return {
    getItem: async (key: string) => {
      try {
        const value = await SecureStore.getItemAsync(key);
        if (!value) return null;

        try {
          const decrypted = await xorTransform(value, encryptionKey);
          JSON.parse(decrypted); // Validate before trusting it — see fallback below.
          return decrypted;
        } catch {
          // Either not yet encrypted (data written before this adapter
          // applied encryption) or corrupt ciphertext. Fall back to the
          // raw value so an existing session isn't dropped; the next
          // `setItem` (triggered by any subsequent state change) re-saves
          // it through the encrypted path, migrating it in place.
          JSON.parse(value);
          return value;
        }
      } catch (error) {
        console.error(`[Persistence] Failed to get encrypted item ${key}:`, error);
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        const encrypted = await xorTransform(value, encryptionKey);
        await SecureStore.setItemAsync(key, encrypted, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
      } catch (error) {
        console.error(`[Persistence] Failed to set encrypted item ${key}:`, error);
      }
    },
    removeItem: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error(`[Persistence] Failed to remove encrypted item ${key}:`, error);
      }
    },
  };
};

// Migration utilities
export interface Migration {
  version: number;
  up: (state: any) => Promise<any> | any;
  down?: (state: any) => Promise<any> | any;
}

export const runMigrations = async (
  state: any,
  currentVersion: number,
  migrations: Migration[]
): Promise<any> => {
  let migratedState = state;
  let version = currentVersion;

  // Sort migrations by version
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    if (migration.version > version) {
      migratedState = await migration.up(migratedState);
      version = migration.version;
    }
  }

  return migratedState;
};

// Versioned storage helper
export const createVersionedStorage = (
  storage: StorageAdapter,
  key: string,
  currentVersion: number,
  migrations: Migration[] = []
): StorageAdapter => {
  return {
    getItem: async (keyName: string) => {
      try {
        const data = await storage.getItem(keyName);
        if (!data) return null;

        const parsed = JSON.parse(data);
        const storedVersion = parsed._version || 0;

        if (storedVersion < currentVersion) {
          // Migrate the state
          const migratedState = await runMigrations(
            parsed.state || parsed,
            storedVersion,
            migrations
          );
          // Save migrated state
          const newData = JSON.stringify({
            _version: currentVersion,
            state: migratedState,
          });
          await storage.setItem(keyName, newData);
          return JSON.stringify(migratedState);
        }

        return JSON.stringify(parsed.state || parsed);
      } catch (error) {
        console.error(`[Persistence] Versioned storage get error:`, error);
        return null;
      }
    },
    setItem: async (keyName: string, value: string) => {
      try {
        const data = JSON.stringify({
          _version: currentVersion,
          state: JSON.parse(value),
        });
        await storage.setItem(keyName, data);
      } catch (error) {
        console.error(`[Persistence] Versioned storage set error:`, error);
      }
    },
    removeItem: async (keyName: string) => {
      try {
        await storage.removeItem(keyName);
      } catch (error) {
        console.error(`[Persistence] Versioned storage remove error:`, error);
      }
    },
  };
};

// Persistence error handling
export class PersistenceError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export const handlePersistenceError = (error: any, fallback: any): any => {
  console.error('[Persistence] Error:', error);
  return fallback;
};

// Create storage with fallback
export const createStorageWithFallback = (
  primary: StorageAdapter,
  fallback: StorageAdapter
): StorageAdapter => {
  return {
    getItem: async (key: string) => {
      try {
        const result = await primary.getItem(key);
        if (result !== null) return result;
        return await fallback.getItem(key);
      } catch (error) {
        console.warn('[Persistence] Primary storage failed, using fallback');
        return await fallback.getItem(key);
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await primary.setItem(key, value);
      } catch (error) {
        console.warn('[Persistence] Primary storage set failed, using fallback');
        await fallback.setItem(key, value);
      }
    },
    removeItem: async (key: string) => {
      try {
        await primary.removeItem(key);
      } catch (error) {
        console.warn('[Persistence] Primary storage remove failed, using fallback');
        await fallback.removeItem(key);
      }
    },
  };
};