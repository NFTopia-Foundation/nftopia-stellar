// Use the existing validation.ts pattern instead of importing joi directly
import { validateEnv } from './validation';

export interface BlockchainConfig {
  starknet: {
    rpcUrl: string;
    contractAddresses: {
      marketplace: string;
      auction: string;
      nft: string;
    };
    accountAddress: string;
    privateKey: string;
    eventListener: {
      pollingInterval: number;
      batchSize: number;
      startBlock: number;
      maxRetries: number;
      circuitBreakerThreshold: number;
      circuitBreakerTimeout: number;
    };
  };
}

export const getBlockchainConfig = (): BlockchainConfig => {
  // Validate required environment variables
  const requiredVars = [
    'STARKNET_RPC_URL',
    'STARKNET_MARKETPLACE_CONTRACT',
    'STARKNET_AUCTION_CONTRACT', 
    'STARKNET_NFT_CONTRACT',
    'STARKNET_ACCOUNT_ADDRESS',
    'STARKNET_PRIVATE_KEY'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    starknet: {
      rpcUrl: process.env.STARKNET_RPC_URL!,
      contractAddresses: {
        marketplace: process.env.STARKNET_MARKETPLACE_CONTRACT!,
        auction: process.env.STARKNET_AUCTION_CONTRACT!,
        nft: process.env.STARKNET_NFT_CONTRACT!,
      },
      accountAddress: process.env.STARKNET_ACCOUNT_ADDRESS!,
      privateKey: process.env.STARKNET_PRIVATE_KEY!,
      eventListener: {
        pollingInterval: Number(process.env.EVENT_POLLING_INTERVAL) || 5000,
        batchSize: Number(process.env.EVENT_BATCH_SIZE) || 100,
        startBlock: Number(process.env.EVENT_START_BLOCK) || 0,
        maxRetries: Number(process.env.EVENT_MAX_RETRIES) || 3,
        circuitBreakerThreshold: Number(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
        circuitBreakerTimeout: Number(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000,
      },
    },
  };
};