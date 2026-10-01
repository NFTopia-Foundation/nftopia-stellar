import { getMongoConfig, mongoEnvironmentFromProcessEnv } from './mongo.config';

describe('getMongoConfig', () => {
  it('falls back to the default URI and db name', () => {
    const config = getMongoConfig({});
    expect(config.uri).toBe('mongodb://localhost:27017');
    expect(config.dbName).toBe('nftopia_analytics');
  });

  it('honors an explicit URI and db name', () => {
    const config = getMongoConfig({
      mongoUri: 'mongodb://mongo.internal:27017',
      mongoDbName: 'custom_analytics',
    });
    expect(config.uri).toBe('mongodb://mongo.internal:27017');
    expect(config.dbName).toBe('custom_analytics');
  });

  describe('retry/backoff defaults', () => {
    it('defaults retryAttempts to 10 and retryDelay to 3000ms', () => {
      const config = getMongoConfig({});
      expect(config.retryAttempts).toBe(10);
      expect(config.retryDelay).toBe(3000);
    });

    it('is overridable via MONGO_RETRY_ATTEMPTS / MONGO_RETRY_DELAY_MS', () => {
      const config = getMongoConfig({
        mongoRetryAttempts: '5',
        mongoRetryDelayMs: '1000',
      });
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelay).toBe(1000);
    });

    it('rejects a non-positive-integer MONGO_RETRY_ATTEMPTS', () => {
      expect(() => getMongoConfig({ mongoRetryAttempts: '0' })).toThrow(
        /MONGO_RETRY_ATTEMPTS/,
      );
      expect(() => getMongoConfig({ mongoRetryAttempts: '-1' })).toThrow(
        /MONGO_RETRY_ATTEMPTS/,
      );
      expect(() => getMongoConfig({ mongoRetryAttempts: 'many' })).toThrow(
        /MONGO_RETRY_ATTEMPTS/,
      );
      expect(() => getMongoConfig({ mongoRetryAttempts: '2.5' })).toThrow(
        /MONGO_RETRY_ATTEMPTS/,
      );
    });
  });

  describe('timeouts', () => {
    it('defaults connectTimeoutMS and serverSelectionTimeoutMS to 10000ms', () => {
      const config = getMongoConfig({});
      expect(config.connectTimeoutMS).toBe(10000);
      expect(config.serverSelectionTimeoutMS).toBe(10000);
    });

    it('is overridable via MONGO_CONNECT_TIMEOUT_MS / MONGO_SERVER_SELECTION_TIMEOUT_MS', () => {
      const config = getMongoConfig({
        mongoConnectTimeoutMs: '5000',
        mongoServerSelectionTimeoutMs: '2000',
      });
      expect(config.connectTimeoutMS).toBe(5000);
      expect(config.serverSelectionTimeoutMS).toBe(2000);
    });

    it('rejects a non-positive-integer MONGO_CONNECT_TIMEOUT_MS', () => {
      expect(() => getMongoConfig({ mongoConnectTimeoutMs: '0' })).toThrow(
        /MONGO_CONNECT_TIMEOUT_MS/,
      );
    });
  });
});

describe('mongoEnvironmentFromProcessEnv', () => {
  it('reads the MONGO_* variables off the given process.env-like object', () => {
    const env = mongoEnvironmentFromProcessEnv({
      MONGO_URI: 'mongodb://mongo.internal:27017',
      MONGO_DB_NAME: 'custom_analytics',
      MONGO_RETRY_ATTEMPTS: '5',
      MONGO_RETRY_DELAY_MS: '1000',
      MONGO_CONNECT_TIMEOUT_MS: '5000',
      MONGO_SERVER_SELECTION_TIMEOUT_MS: '2000',
    });

    expect(env).toEqual({
      mongoUri: 'mongodb://mongo.internal:27017',
      mongoDbName: 'custom_analytics',
      mongoRetryAttempts: '5',
      mongoRetryDelayMs: '1000',
      mongoConnectTimeoutMs: '5000',
      mongoServerSelectionTimeoutMs: '2000',
    });
  });
});
