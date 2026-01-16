// src/config/validation.ts
import * as Joi from 'joi';

export function validateEnv(config: Record<string, any>) {
  const schema = Joi.object({
    STARKNET_RPC_URL: Joi.string().uri().required(),
    STARKNET_CONTRACT_ADDRESS: Joi.string().required(),
    STARKNET_ACCOUNT_ADDRESS: Joi.string().required(),
    STARKNET_PRIVATE_KEY: Joi.string().required(),
    // Add new blockchain config validation
    STARKNET_MARKETPLACE_CONTRACT: Joi.string().required(),
    STARKNET_AUCTION_CONTRACT: Joi.string().required(),
    STARKNET_NFT_CONTRACT: Joi.string().required(),
    EVENT_POLLING_INTERVAL: Joi.number().default(5000),
    EVENT_BATCH_SIZE: Joi.number().default(100),
    EVENT_START_BLOCK: Joi.number().default(0),
    EVENT_MAX_RETRIES: Joi.number().default(3),
    CIRCUIT_BREAKER_THRESHOLD: Joi.number().default(5),
    CIRCUIT_BREAKER_TIMEOUT: Joi.number().default(30000),
    JWT_SECRET: Joi.string().required(),
    PORT: Joi.number().default(3000),
  });

  const { error, value } = schema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (error) {
    throw new Error(`❌ Environment validation error:\n${error.message}`);
  }

  return value;
}
