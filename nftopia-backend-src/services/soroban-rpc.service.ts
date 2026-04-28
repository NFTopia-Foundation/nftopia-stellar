import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getStellarConfig,
  type StellarRuntimeConfig,
} from '../config/stellar.config';

@Injectable()
export class SorobanRpcService {
  constructor(private readonly configService: ConfigService) {}

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
}
