// Added Joi in package.json
import * as Joi from 'joi';

export const starknetValidationSchema = Joi.object({
  STARKNET_RPC_URL: Joi.string().required(),
  STARKNET_CONTRACT_ADDRESS: Joi.string().required(),
  STARKNET_ACCOUNT_ADDRESS: Joi.string().required(),
  STARKNET_PRIVATE_KEY: Joi.string().required(),
});
