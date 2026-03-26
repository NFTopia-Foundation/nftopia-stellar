export type StellarRuntimeConfig = {
  network: 'testnet' | 'mainnet';
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  defaultTimeoutMs: number;
  simulationTimeoutMs: number;
  submissionTimeoutMs: number;
  loggingLevel: 'debug' | 'info';
  obfuscateSensitiveErrors: boolean;
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

export function getStellarConfig(
  env: NodeJS.ProcessEnv = process.env,
): StellarRuntimeConfig {
  const network = env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  const isMainnet = network === 'mainnet';

  return {
    network,
    horizonUrl:
      env.STELLAR_HORIZON_URL ||
      (isMainnet
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org'),
    sorobanRpcUrl:
      env.SOROBAN_RPC_URL ||
      (isMainnet
        ? 'https://mainnet.sorobanrpc.com'
        : 'https://soroban-testnet.stellar.org'),
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
  };
}
