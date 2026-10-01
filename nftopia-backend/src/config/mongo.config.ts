/**
 * Config resolution for the MongoDB connection used for analytics/event
 * data (#531). Kept as a pure function over an env-like object — same
 * convention as tracing.config.ts / stellar.config.ts — so it's cheap to
 * unit test without booting a real connection.
 *
 * MongoDB is intentionally separate from the Postgres/TypeORM connection:
 * it holds flexible, schema-light analytics/event documents that don't
 * belong in the relational schema (see docs/mongodb-analytics.md).
 */
export interface MongoEnvironment {
  mongoUri?: string;
  mongoDbName?: string;
  mongoRetryAttempts?: string;
  mongoRetryDelayMs?: string;
  mongoConnectTimeoutMs?: string;
  mongoServerSelectionTimeoutMs?: string;
}

export interface MongoConfig {
  uri: string;
  dbName: string;
  /** Number of connection attempts NestJS retries before giving up. */
  retryAttempts: number;
  /** Delay in ms between retry attempts (fixed, not exponential). */
  retryDelay: number;
  connectTimeoutMS: number;
  serverSelectionTimeoutMS: number;
}

const DEFAULT_URI = 'mongodb://localhost:27017';
const DEFAULT_DB_NAME = 'nftopia_analytics';
const DEFAULT_RETRY_ATTEMPTS = 10;
const DEFAULT_RETRY_DELAY_MS = 3000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 10000;

function resolvePositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

export function getMongoConfig(env: MongoEnvironment): MongoConfig {
  return {
    uri: env.mongoUri || DEFAULT_URI,
    dbName: env.mongoDbName || DEFAULT_DB_NAME,
    retryAttempts: resolvePositiveInt(
      env.mongoRetryAttempts,
      DEFAULT_RETRY_ATTEMPTS,
      'MONGO_RETRY_ATTEMPTS',
    ),
    retryDelay: resolvePositiveInt(
      env.mongoRetryDelayMs,
      DEFAULT_RETRY_DELAY_MS,
      'MONGO_RETRY_DELAY_MS',
    ),
    connectTimeoutMS: resolvePositiveInt(
      env.mongoConnectTimeoutMs,
      DEFAULT_CONNECT_TIMEOUT_MS,
      'MONGO_CONNECT_TIMEOUT_MS',
    ),
    serverSelectionTimeoutMS: resolvePositiveInt(
      env.mongoServerSelectionTimeoutMs,
      DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
      'MONGO_SERVER_SELECTION_TIMEOUT_MS',
    ),
  };
}

export function mongoEnvironmentFromProcessEnv(
  env: NodeJS.ProcessEnv = process.env,
): MongoEnvironment {
  return {
    mongoUri: env.MONGO_URI,
    mongoDbName: env.MONGO_DB_NAME,
    mongoRetryAttempts: env.MONGO_RETRY_ATTEMPTS,
    mongoRetryDelayMs: env.MONGO_RETRY_DELAY_MS,
    mongoConnectTimeoutMs: env.MONGO_CONNECT_TIMEOUT_MS,
    mongoServerSelectionTimeoutMs: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
  };
}
