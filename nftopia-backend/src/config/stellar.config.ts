export type StellarRuntimeConfig = {
  network: 'testnet' | 'mainnet';
  horizonUrl: string;
  sorobanRpcUrl: string;
  /** True when sorobanRpcUrl came from the built-in default rather than SOROBAN_RPC_URL. */
  sorobanRpcUrlIsFallback: boolean;
  networkPassphrase: string;
  defaultTimeoutMs: number;
  simulationTimeoutMs: number;
  submissionTimeoutMs: number;
  loggingLevel: 'debug' | 'info';
  obfuscateSensitiveErrors: boolean;
  sorobanRpcMaxRetries: number;
  sorobanRpcRetryDelayMs: number;
  sorobanRpcRetryBackoffMultiplier: number;
  sorobanRpcRetryMaxDelayMs: number;
};

function asInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Validate and normalize the Soroban RPC URL.
 *
 * Throws an Error with a clear, actionable message when the URL is missing
 * (in production) or malformed, so the application fails fast at startup rather
 * than producing cryptic runtime errors on the first contract call.
 *
 * @param rawUrl - The configured value (may be undefined when relying on the default).
 * @param options - The resolved network, runtime environment, and the default URL.
 * @returns The normalized URL with trailing slashes removed.
 */
export function validateAndNormalizeSorobanRpcUrl(
  rawUrl: string | undefined,
  options: {
    network: 'testnet' | 'mainnet';
    nodeEnv?: string;
    fallback: string;
  },
): string {
  const { nodeEnv, fallback } = options;
  const isProduction = nodeEnv === 'production';
  const trimmed = rawUrl?.trim();

  // Production requires an explicit value; never fall back silently.
  if (isProduction && !trimmed) {
    throw new Error(
      'SOROBAN_RPC_URL is required in production. Set it to a valid Soroban RPC ' +
        'endpoint, e.g. https://mainnet.sorobanrpc.com',
    );
  }

  const candidate = trimmed || fallback;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      `Invalid SOROBAN_RPC_URL: "${candidate}" is not a valid URL. ` +
        'Expected a full URL such as https://soroban-testnet.stellar.org',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid SOROBAN_RPC_URL protocol "${parsed.protocol}". ` +
        'Only http and https are supported.',
    );
  }

  if (!parsed.hostname) {
    throw new Error(
      `Invalid SOROBAN_RPC_URL: "${candidate}" has an empty hostname.`,
    );
  }

  const isLocalhost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';

  if (isProduction) {
    if (parsed.protocol !== 'https:') {
      throw new Error(
        `Insecure SOROBAN_RPC_URL "${candidate}" in production. Use an https endpoint.`,
      );
    }

    if (isLocalhost) {
      throw new Error(
        `SOROBAN_RPC_URL points to localhost ("${candidate}") in production. ` +
          'Configure a reachable Soroban RPC endpoint.',
      );
    }
  }

  // Normalize: drop trailing slashes from the path so request construction is
  // consistent (e.g. ".../" and "..." are treated the same).
  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${normalizedPath}${parsed.search}`;
}

export function getStellarConfig(
  env: NodeJS.ProcessEnv = process.env,
): StellarRuntimeConfig {
  const network =
    env.STELLAR_NETWORK?.toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
  const isMainnet = network === 'mainnet';
  const isProduction = env.NODE_ENV === 'production';

  const sorobanRpcFallback = isMainnet
    ? 'https://mainnet.sorobanrpc.com'
    : 'https://soroban-testnet.stellar.org';

  const sorobanRpcUrl = validateAndNormalizeSorobanRpcUrl(env.SOROBAN_RPC_URL, {
    network,
    nodeEnv: env.NODE_ENV,
    fallback: sorobanRpcFallback,
  });

  return {
    network,
    horizonUrl:
      env.STELLAR_HORIZON_URL ||
      (isMainnet
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org'),
    sorobanRpcUrl,
    sorobanRpcUrlIsFallback: !env.SOROBAN_RPC_URL?.trim(),
    networkPassphrase:
      env.STELLAR_NETWORK_PASSPHRASE ||
      (isMainnet
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015'),
    defaultTimeoutMs: asInt(env.STELLAR_TIMEOUT_DEFAULT_MS, 30_000),
    simulationTimeoutMs: asInt(env.STELLAR_TIMEOUT_SIMULATION_MS, 15_000),
    submissionTimeoutMs: asInt(env.STELLAR_TIMEOUT_SUBMISSION_MS, 45_000),
    loggingLevel: env.STELLAR_LOG_LEVEL === 'debug' ? 'debug' : 'info',
    obfuscateSensitiveErrors: asBool(
      env.STELLAR_OBFUSCATE_SENSITIVE_ERRORS,
      env.NODE_ENV === 'production',
    ),
    sorobanRpcMaxRetries: asInt(env.SOROBAN_RPC_MAX_RETRIES, 3),
    sorobanRpcRetryDelayMs: asInt(env.SOROBAN_RPC_RETRY_DELAY_MS, 1_000),
    sorobanRpcRetryBackoffMultiplier: asInt(
      env.SOROBAN_RPC_RETRY_BACKOFF_MULTIPLIER,
      2,
    ),
    sorobanRpcRetryMaxDelayMs: asInt(
      env.SOROBAN_RPC_RETRY_MAX_DELAY_MS,
      30_000,
    ),
  };
}
