import {
  getStellarConfig,
  validateAndNormalizeSorobanRpcUrl,
} from './stellar.config';

describe('validateAndNormalizeSorobanRpcUrl', () => {
  const base = {
    network: 'testnet' as const,
    fallback: 'https://rpc.example.com',
  };

  it('returns the fallback when no URL is provided (development)', () => {
    expect(
      validateAndNormalizeSorobanRpcUrl(undefined, {
        ...base,
        nodeEnv: 'development',
      }),
    ).toBe('https://rpc.example.com');
  });

  it('removes trailing slashes', () => {
    expect(
      validateAndNormalizeSorobanRpcUrl('https://rpc.example.com/', base),
    ).toBe('https://rpc.example.com');
    expect(
      validateAndNormalizeSorobanRpcUrl(
        'https://rpc.example.com/rpc/v1//',
        base,
      ),
    ).toBe('https://rpc.example.com/rpc/v1');
  });

  it('rejects malformed URLs', () => {
    expect(() => validateAndNormalizeSorobanRpcUrl('not-a-url', base)).toThrow(
      /not a valid URL/,
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() =>
      validateAndNormalizeSorobanRpcUrl('ftp://rpc.example.com', base),
    ).toThrow(/protocol/);
  });

  it('requires a URL in production', () => {
    expect(() =>
      validateAndNormalizeSorobanRpcUrl(undefined, {
        ...base,
        nodeEnv: 'production',
      }),
    ).toThrow(/required in production/);
  });

  it('rejects http in production', () => {
    expect(() =>
      validateAndNormalizeSorobanRpcUrl('http://rpc.example.com', {
        ...base,
        nodeEnv: 'production',
      }),
    ).toThrow(/https/);
  });

  it('rejects localhost in production', () => {
    expect(() =>
      validateAndNormalizeSorobanRpcUrl('https://localhost:8000', {
        ...base,
        nodeEnv: 'production',
      }),
    ).toThrow(/localhost/);
  });

  it('accepts a valid https URL in production', () => {
    expect(
      validateAndNormalizeSorobanRpcUrl('https://mainnet.sorobanrpc.com/', {
        network: 'mainnet',
        nodeEnv: 'production',
        fallback: 'https://mainnet.sorobanrpc.com',
      }),
    ).toBe('https://mainnet.sorobanrpc.com');
  });
});

describe('getStellarConfig', () => {
  it('falls back to the testnet RPC URL and flags it as fallback', () => {
    const config = getStellarConfig({
      NODE_ENV: 'development',
    });
    expect(config.network).toBe('testnet');
    expect(config.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.sorobanRpcUrlIsFallback).toBe(true);
  });

  it('uses and normalizes an explicit SOROBAN_RPC_URL', () => {
    const config = getStellarConfig({
      NODE_ENV: 'development',
      SOROBAN_RPC_URL: 'https://custom.rpc.example.com/',
    });
    expect(config.sorobanRpcUrl).toBe('https://custom.rpc.example.com');
    expect(config.sorobanRpcUrlIsFallback).toBe(false);
  });

  it('throws for an invalid SOROBAN_RPC_URL', () => {
    expect(() =>
      getStellarConfig({
        NODE_ENV: 'development',
        SOROBAN_RPC_URL: 'http://',
      }),
    ).toThrow();
  });
});
