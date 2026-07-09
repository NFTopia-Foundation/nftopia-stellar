import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getStellarConfig,
  type StellarRuntimeConfig,
} from '../config/stellar.config';

export type SorobanRpcRetryMetrics = {
  totalRetryAttempts: number;
  successfulRecoveries: number;
  exhaustedRetries: number;
};

export const sorobanRpcRetryMetrics: SorobanRpcRetryMetrics = {
  totalRetryAttempts: 0,
  successfulRecoveries: 0,
  exhaustedRetries: 0,
};

export type SorobanRpcRetryOptions = {
  config: Pick<
    StellarRuntimeConfig,
    | 'sorobanRpcMaxRetries'
    | 'sorobanRpcRetryDelayMs'
    | 'sorobanRpcRetryBackoffMultiplier'
    | 'sorobanRpcRetryMaxDelayMs'
  >;
  methodName?: string;
  logger?: Logger;
};

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
]);

const NON_RETRYABLE_MESSAGE_PATTERNS = [
  'simulation failed',
  'bad sequence',
  'tx_bad_seq',
  'insufficient',
  'invalid',
  'unauthorized',
  'forbidden',
  'bad request',
  'soroban submission error',
];

const RETRYABLE_MESSAGE_PATTERNS = [
  'timeout',
  'timed out',
  'network error',
  'fetch failed',
  'unavailable',
  'socket hang up',
  'rate limit',
  'too many requests',
  '502',
  '503',
  '504',
  '500',
  '429',
  'econnreset',
  'econnrefused',
  'etimedout',
  'enotfound',
];

const wait = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function calculateExponentialBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number,
): number {
  const exponentialDelay =
    baseDelayMs * Math.pow(backoffMultiplier, Math.max(0, attempt - 1));

  return Math.min(exponentialDelay, maxDelayMs);
}

export function isRetryableSorobanRpcError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const status =
    (error as { status?: number }).status ??
    (error as { response?: { status?: number } }).response?.status;

  if (typeof status === 'number') {
    if (status >= 500) {
      return true;
    }

    if (status === 408 || status === 429) {
      return true;
    }

    if (status >= 400 && status < 500) {
      return false;
    }
  }

  const code = (error as { code?: string }).code;
  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return true;
  }

  const message = formatUnknownError(error).toLowerCase();

  if (
    NON_RETRYABLE_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))
  ) {
    return false;
  }

  if (RETRYABLE_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))) {
    return true;
  }

  return false;
}

export async function retrySorobanRpcCall<T>(
  operation: () => Promise<T>,
  options: SorobanRpcRetryOptions,
): Promise<T> {
  const maxAttempts = Math.max(1, options.config.sorobanRpcMaxRetries);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await operation();

      if (attempt > 1) {
        sorobanRpcRetryMetrics.successfulRecoveries += 1;
      }

      return result;
    } catch (error) {
      const canRetry =
        attempt < maxAttempts && isRetryableSorobanRpcError(error);

      if (!canRetry) {
        if (attempt >= maxAttempts && isRetryableSorobanRpcError(error)) {
          sorobanRpcRetryMetrics.exhaustedRetries += 1;
        }

        throw error;
      }

      const delayMs = calculateExponentialBackoffDelayMs(
        attempt,
        options.config.sorobanRpcRetryDelayMs,
        options.config.sorobanRpcRetryBackoffMultiplier,
        options.config.sorobanRpcRetryMaxDelayMs,
      );

      sorobanRpcRetryMetrics.totalRetryAttempts += 1;

      options.logger?.warn(
        `Soroban RPC retry: method=${options.methodName ?? 'unknown'} attempt=${attempt}/${maxAttempts} delayMs=${delayMs} error=${formatUnknownError(error)}`,
      );

      await wait(delayMs);
    }
  }

  throw new Error('Soroban RPC retry operation failed');
}

@Injectable()
export class SorobanRpcService implements OnModuleInit {
  private readonly logger = new Logger(SorobanRpcService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const config = this.getRuntimeConfig();

    if (config.horizonUrlIsFallback) {
      this.logger.warn(
        `STELLAR_HORIZON_URL is not set. Falling back to default Horizon URL: ${config.horizonUrl}`,
      );
    }

    this.logger.log(
      `Stellar network: ${config.network.toUpperCase()} | Horizon URL: ${config.horizonUrl} | Soroban RPC: ${config.sorobanRpcUrl}`,
    );

    await this.healthCheckHorizon(config);
  }

  getRuntimeConfig(): StellarRuntimeConfig {
    return getStellarConfig({
      ...process.env,
      STELLAR_NETWORK: this.configService.get<string>('STELLAR_NETWORK'),
      STELLAR_HORIZON_URL: this.configService.get<string>(
        'STELLAR_HORIZON_URL',
      ),
      SOROBAN_RPC_URL: this.configService.get<string>('SOROBAN_RPC_URL'),
      STELLAR_NETWORK_PASSPHRASE: this.configService.get<string>(
        'STELLAR_NETWORK_PASSPHRASE',
      ),
      STELLAR_TIMEOUT_DEFAULT_MS: this.configService.get<string>(
        'STELLAR_TIMEOUT_DEFAULT_MS',
      ),
      STELLAR_TIMEOUT_SIMULATION_MS: this.configService.get<string>(
        'STELLAR_TIMEOUT_SIMULATION_MS',
      ),
      STELLAR_TIMEOUT_SUBMISSION_MS: this.configService.get<string>(
        'STELLAR_TIMEOUT_SUBMISSION_MS',
      ),
      STELLAR_LOG_LEVEL: this.configService.get<string>('STELLAR_LOG_LEVEL'),
      STELLAR_OBFUSCATE_SENSITIVE_ERRORS: this.configService.get<string>(
        'STELLAR_OBFUSCATE_SENSITIVE_ERRORS',
      ),
      SOROBAN_RPC_MAX_RETRIES: this.configService.get<string>(
        'SOROBAN_RPC_MAX_RETRIES',
      ),
      SOROBAN_RPC_RETRY_DELAY_MS: this.configService.get<string>(
        'SOROBAN_RPC_RETRY_DELAY_MS',
      ),
      SOROBAN_RPC_RETRY_BACKOFF_MULTIPLIER: this.configService.get<string>(
        'SOROBAN_RPC_RETRY_BACKOFF_MULTIPLIER',
      ),
      SOROBAN_RPC_RETRY_MAX_DELAY_MS: this.configService.get<string>(
        'SOROBAN_RPC_RETRY_MAX_DELAY_MS',
      ),
    });
  }

  getRetryMetrics(): SorobanRpcRetryMetrics {
    return { ...sorobanRpcRetryMetrics };
  }

  retryRpcCall<T>(
    operation: () => Promise<T>,
    methodName?: string,
  ): Promise<T> {
    const config = this.getRuntimeConfig();

    return retrySorobanRpcCall(operation, {
      config,
      methodName,
      logger: this.logger,
    });
  }

  getNetworkContext() {
    const config = this.getRuntimeConfig();

    return {
      network: config.network,
      horizonUrl: config.horizonUrl,
      sorobanRpcUrl: config.sorobanRpcUrl,
      networkPassphrase: config.networkPassphrase,
    };
  }

  getTimeoutThreshold(requestKind: 'simulation' | 'submission' | 'default') {
    const config = this.getRuntimeConfig();

    if (requestKind === 'simulation') {
      return config.simulationTimeoutMs;
    }

    if (requestKind === 'submission') {
      return config.submissionTimeoutMs;
    }

    return config.defaultTimeoutMs;
  }

  inferRequestKind(methodName?: string) {
    if (!methodName) {
      return 'default' as const;
    }

    const normalized = methodName.toLowerCase();

    if (
      normalized.includes('simulate') ||
      normalized.includes('preview') ||
      normalized.includes('dryrun')
    ) {
      return 'simulation' as const;
    }

    if (
      normalized.includes('submit') ||
      normalized.includes('send') ||
      normalized.includes('invoke')
    ) {
      return 'submission' as const;
    }

    return 'default' as const;
  }

  private async healthCheckHorizon(
    config: StellarRuntimeConfig,
  ): Promise<void> {
    if (process.env.STELLAR_HORIZON_HEALTH_CHECK === 'false') {
      this.logger.warn(
        'Horizon health check skipped (STELLAR_HORIZON_HEALTH_CHECK=false).',
      );
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${config.horizonUrl}/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(
          `Horizon returned HTTP ${response.status} ${response.statusText}`,
        );
      }

      this.logger.log(
        `Horizon health check passed: ${config.horizonUrl} is reachable.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown reachability error';
      const errorMessage = `Horizon health check failed for ${config.horizonUrl}: ${message}`;

      this.logger.error(errorMessage);

      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(errorMessage);
      }
    }
  }
}
