import * as fs from 'fs';
import * as path from 'path';

/**
 * The set of environment variable names that Docker secrets resolve into.
 * Each entry maps a `SECRET_FILE_*` pointer env var to the target env var
 * that the application reads at runtime.
 *
 * In production, the NestJS app must NEVER receive raw credential values
 * through environment variables. Instead, `docker-compose.prod.yml` passes
 * the path to each mounted secret file via `SECRET_FILE_*` vars and this
 * loader reads the file content, sets the resolved value in `process.env`,
 * and removes the path pointer so the raw filesystem path is not leaked
 * to application code.
 */
const SECRET_FILE_MAPPINGS: ReadonlyArray<{
  /** The env var holding the path to the secret file (e.g. SECRET_FILE_JWT). */
  readonly fileEnvVar: string;
  /** The env var the app reads for the actual secret value (e.g. JWT_SECRET). */
  readonly targetEnvVar: string;
}> = [
  { fileEnvVar: 'SECRET_FILE_JWT', targetEnvVar: 'JWT_SECRET' },
  { fileEnvVar: 'SECRET_FILE_DB_PASSWORD', targetEnvVar: 'DB_PASSWORD' },
  {
    fileEnvVar: 'SECRET_FILE_STELLAR_OPERATOR',
    targetEnvVar: 'STELLAR_OPERATOR_SECRET',
  },
  { fileEnvVar: 'SECRET_FILE_PINATA_JWT', targetEnvVar: 'IPFS_PINATA_JWT' },
  {
    fileEnvVar: 'SECRET_FILE_MEILISEARCH_KEY',
    targetEnvVar: 'MEILISEARCH_API_KEY',
  },
  {
    fileEnvVar: 'SECRET_FILE_REDIS_PASSWORD',
    targetEnvVar: 'REDIS_PASSWORD',
  },
] as const;

/** Result returned by {@link loadDockerSecrets} for observability. */
export interface SecretsLoadResult {
  /** Number of secrets successfully resolved from files. */
  readonly loadedCount: number;
  /** Names of the target env vars that were populated (no values). */
  readonly loadedVars: ReadonlyArray<string>;
  /** Names of optional secrets that were not configured (file env var absent). */
  readonly skippedVars: ReadonlyArray<string>;
}

/**
 * Signature for the file-reader dependency.
 * Matches the synchronous `fs.readFileSync(path, 'utf8')` overload.
 */
export type ReadFileFn = (filePath: string, encoding: 'utf8') => string;

/**
 * Loads Docker secrets into `process.env` before the application starts.
 *
 * ### Why this exists
 * Docker secrets are mounted as read-only files under `/run/secrets/` inside
 * the container. The compose file sets `SECRET_FILE_*` env vars to the path
 * of each file. This loader reads those files, populates the canonical env vars
 * that the NestJS config module expects, and then deletes the `SECRET_FILE_*`
 * pointers so the raw filesystem paths are never visible to application code
 * (and do not appear in `docker inspect` output).
 *
 * ### Failure modes
 * - If a `SECRET_FILE_*` var is set but the file does not exist or is
 *   unreadable, this function throws — failing fast at startup rather than
 *   allowing the app to run with a missing credential.
 * - If the resolved secret value is an empty string, this function throws.
 *   Empty secrets are almost always a provisioning mistake.
 * - If `SECRET_FILE_*` is absent (undefined), the mapping is skipped without
 *   error to support optional secrets (e.g. Arweave wallet, web3.storage).
 *
 * ### Testability
 * The `readFileFn` parameter defaults to `fs.readFileSync` in production but
 * can be replaced with a plain jest mock function in tests, avoiding the
 * `Cannot redefine property` error that occurs when spying on Node.js
 * built-in non-configurable properties.
 *
 * @param readFileFn - Dependency-injected file reader; defaults to `fs.readFileSync`.
 * @throws {Error} When a declared secret file cannot be read or its content is empty.
 * @returns Metadata describing which secrets were loaded.
 */
export function loadDockerSecrets(
  readFileFn: ReadFileFn = (filePath, encoding) =>
    fs.readFileSync(filePath, encoding),
): SecretsLoadResult {
  const loadedVars: string[] = [];
  const skippedVars: string[] = [];

  for (const { fileEnvVar, targetEnvVar } of SECRET_FILE_MAPPINGS) {
    const secretFilePath = process.env[fileEnvVar];

    // The file pointer is not set — skip this optional mapping.
    if (!secretFilePath) {
      skippedVars.push(targetEnvVar);
      continue;
    }

    const resolvedPath = path.resolve(secretFilePath);

    let rawContent: string;
    try {
      rawContent = readFileFn(resolvedPath, 'utf8');
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[SecretsLoader] Failed to read secret file for "${targetEnvVar}". ` +
          `File path (from ${fileEnvVar}): "${resolvedPath}". ` +
          `Cause: ${cause}. ` +
          `Ensure the Docker secret is provisioned and mounted correctly.`,
      );
    }

    // Strip leading/trailing whitespace that editors or echo commands may add.
    const secretValue = rawContent.trim();

    if (secretValue.length === 0) {
      throw new Error(
        `[SecretsLoader] Secret file for "${targetEnvVar}" is empty. ` +
          `File path (from ${fileEnvVar}): "${resolvedPath}". ` +
          `Provision a non-empty value with: ` +
          `printf 'your-secret' | docker secret create ${targetEnvVar.toLowerCase()} -`,
      );
    }

    // Populate the canonical env var.
    process.env[targetEnvVar] = secretValue;

    // Remove the file-path pointer so it cannot be observed by application code.
    delete process.env[fileEnvVar];

    loadedVars.push(targetEnvVar);
  }

  return {
    loadedCount: loadedVars.length,
    loadedVars: Object.freeze([...loadedVars]),
    skippedVars: Object.freeze([...skippedVars]),
  };
}
