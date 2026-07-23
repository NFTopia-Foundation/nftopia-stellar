import * as path from 'path';
import {
  loadDockerSecrets,
  ReadFileFn,
  SecretsLoadResult,
} from './secrets.loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Capture and restore process.env around each test to prevent state leakage.
 * Accepts the fixture env vars to set for the duration of each test in the
 * surrounding describe block.
 */
function withCleanEnv(vars: Record<string, string | undefined>) {
  const ALL_MANAGED_KEYS = [
    'SECRET_FILE_JWT',
    'SECRET_FILE_DB_PASSWORD',
    'SECRET_FILE_STELLAR_OPERATOR',
    'SECRET_FILE_PINATA_JWT',
    'SECRET_FILE_MEILISEARCH_KEY',
    'SECRET_FILE_REDIS_PASSWORD',
    'JWT_SECRET',
    'DB_PASSWORD',
    'STELLAR_OPERATOR_SECRET',
    'IPFS_PINATA_JWT',
    'MEILISEARCH_API_KEY',
    'REDIS_PASSWORD',
  ] as const;

  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Snapshot and clear all env vars touched by the loader.
    for (const key of ALL_MANAGED_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
    // Apply fixture overrides.
    for (const [key, value] of Object.entries(vars)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
  });

  afterEach(() => {
    // Restore original environment exactly.
    for (const key of ALL_MANAGED_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });
}

/**
 * Creates a ReadFileFn mock that returns the given content for any path.
 */
function makeReader(content: string): ReadFileFn {
  return (_filePath: string, _encoding: 'utf8') => content;
}

/**
 * Creates a ReadFileFn mock that throws an ENOENT-like error.
 */
function makeFailingReader(message: string): ReadFileFn {
  return () => {
    const err: NodeJS.ErrnoException = new Error(message);
    err.code = 'ENOENT';
    throw err;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadDockerSecrets', () => {
  // -------------------------------------------------------------------------
  // No-op when SECRET_FILE_* vars are absent (development mode)
  // -------------------------------------------------------------------------
  describe('when no SECRET_FILE_* vars are set', () => {
    withCleanEnv({});

    it('returns loadedCount=0 and skips all mappings without reading any files', () => {
      const neverCalled: ReadFileFn = () => {
        throw new Error('readFileFn must not be called when no pointers are set');
      };

      const result: SecretsLoadResult = loadDockerSecrets(neverCalled);

      expect(result.loadedCount).toBe(0);
      expect(result.loadedVars).toHaveLength(0);
      expect(result.skippedVars).toHaveLength(6);
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — single secret resolved
  // -------------------------------------------------------------------------
  describe('when SECRET_FILE_JWT is set to a valid file', () => {
    withCleanEnv({ SECRET_FILE_JWT: '/run/secrets/jwt_secret' });

    it('reads the file, sets JWT_SECRET in process.env, and removes the pointer', () => {
      const expectedPath = path.resolve('/run/secrets/jwt_secret');
      let capturedPath: string | undefined;

      const reader: ReadFileFn = (filePath) => {
        capturedPath = filePath;
        return 'super-secret-jwt-value\n'; // Simulate trailing newline
      };

      const result: SecretsLoadResult = loadDockerSecrets(reader);

      expect(capturedPath).toBe(expectedPath);
      expect(result.loadedCount).toBe(1);
      expect(result.loadedVars).toContain('JWT_SECRET');
      // Value is trimmed before storage.
      expect(process.env.JWT_SECRET).toBe('super-secret-jwt-value');
      // File path pointer must be removed.
      expect(process.env.SECRET_FILE_JWT).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — all secrets resolved simultaneously
  // -------------------------------------------------------------------------
  describe('when all SECRET_FILE_* vars are set', () => {
    withCleanEnv({
      SECRET_FILE_JWT: '/run/secrets/nftopia_jwt_secret',
      SECRET_FILE_DB_PASSWORD: '/run/secrets/nftopia_db_password',
      SECRET_FILE_STELLAR_OPERATOR: '/run/secrets/nftopia_stellar_operator_secret',
      SECRET_FILE_PINATA_JWT: '/run/secrets/nftopia_pinata_jwt',
      SECRET_FILE_MEILISEARCH_KEY: '/run/secrets/nftopia_meilisearch_master_key',
      SECRET_FILE_REDIS_PASSWORD: '/run/secrets/nftopia_redis_password',
    });

    it('resolves all 6 secrets and leaves no SECRET_FILE_* pointers', () => {
      const result: SecretsLoadResult = loadDockerSecrets(makeReader('test-secret-value'));

      expect(result.loadedCount).toBe(6);
      expect(result.skippedVars).toHaveLength(0);

      expect(process.env.JWT_SECRET).toBe('test-secret-value');
      expect(process.env.DB_PASSWORD).toBe('test-secret-value');
      expect(process.env.STELLAR_OPERATOR_SECRET).toBe('test-secret-value');
      expect(process.env.IPFS_PINATA_JWT).toBe('test-secret-value');
      expect(process.env.MEILISEARCH_API_KEY).toBe('test-secret-value');
      expect(process.env.REDIS_PASSWORD).toBe('test-secret-value');

      // All file path pointers removed.
      expect(process.env.SECRET_FILE_JWT).toBeUndefined();
      expect(process.env.SECRET_FILE_DB_PASSWORD).toBeUndefined();
      expect(process.env.SECRET_FILE_STELLAR_OPERATOR).toBeUndefined();
      expect(process.env.SECRET_FILE_PINATA_JWT).toBeUndefined();
      expect(process.env.SECRET_FILE_MEILISEARCH_KEY).toBeUndefined();
      expect(process.env.SECRET_FILE_REDIS_PASSWORD).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Error — file does not exist
  // -------------------------------------------------------------------------
  describe('when the secret file does not exist', () => {
    withCleanEnv({ SECRET_FILE_JWT: '/run/secrets/missing_file' });

    it('throws with a descriptive message including the target var and file path', () => {
      const reader = makeFailingReader('ENOENT: no such file or directory');

      expect(() => loadDockerSecrets(reader)).toThrow(
        /Failed to read secret file for "JWT_SECRET"/,
      );
      expect(() => loadDockerSecrets(reader)).toThrow(/ENOENT/);
    });
  });

  // -------------------------------------------------------------------------
  // Error — file is empty / whitespace only
  // -------------------------------------------------------------------------
  describe('when the secret file contains only whitespace', () => {
    withCleanEnv({ SECRET_FILE_JWT: '/run/secrets/empty_jwt' });

    it('throws with a descriptive empty-secret message', () => {
      expect(() => loadDockerSecrets(makeReader('   \n   '))).toThrow(
        /Secret file for "JWT_SECRET" is empty/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Value trimming
  // -------------------------------------------------------------------------
  describe('when the secret file has leading/trailing whitespace', () => {
    withCleanEnv({ SECRET_FILE_DB_PASSWORD: '/run/secrets/db_pass' });

    it('trims the secret value before storing it', () => {
      loadDockerSecrets(makeReader('  my-db-password  \n'));

      expect(process.env.DB_PASSWORD).toBe('my-db-password');
    });
  });

  // -------------------------------------------------------------------------
  // Return-value immutability
  // -------------------------------------------------------------------------
  describe('return value arrays', () => {
    withCleanEnv({ SECRET_FILE_JWT: '/run/secrets/jwt' });

    it('returns frozen arrays that cannot be mutated', () => {
      const result: SecretsLoadResult = loadDockerSecrets(makeReader('jwt-value'));

      expect(() => {
        // Deliberately bypass TypeScript to test the runtime Object.freeze guarantee.
        (result.loadedVars as string[]).push('INJECTED');
      }).toThrow(TypeError);

      expect(() => {
        (result.skippedVars as string[]).push('INJECTED');
      }).toThrow(TypeError);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed — some set, some absent
  // -------------------------------------------------------------------------
  describe('when only some SECRET_FILE_* vars are set', () => {
    withCleanEnv({
      SECRET_FILE_JWT: '/run/secrets/jwt',
      SECRET_FILE_REDIS_PASSWORD: '/run/secrets/redis_pass',
    });

    it('loads the configured secrets and skips the rest', () => {
      const result: SecretsLoadResult = loadDockerSecrets(makeReader('value'));

      expect(result.loadedCount).toBe(2);
      expect(result.loadedVars).toEqual(
        expect.arrayContaining(['JWT_SECRET', 'REDIS_PASSWORD']),
      );
      expect(result.skippedVars).toEqual(
        expect.arrayContaining([
          'DB_PASSWORD',
          'STELLAR_OPERATOR_SECRET',
          'IPFS_PINATA_JWT',
          'MEILISEARCH_API_KEY',
        ]),
      );
    });
  });
});
