import { registerAs } from '@nestjs/config';

export default registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  rpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  passphrase:
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    'Test SDF Network ; September 2015',
  timeouts: {
    rpcCall: parseInt(process.env.STELLAR_RPC_TIMEOUT_MS || '30000', 10),
    simulation: parseInt(
      process.env.STELLAR_SIMULATION_TIMEOUT_MS || '15000',
      10,
    ),
    submission: parseInt(
      process.env.STELLAR_SUBMISSION_TIMEOUT_MS || '45000',
      10,
    ),
  },
}));
