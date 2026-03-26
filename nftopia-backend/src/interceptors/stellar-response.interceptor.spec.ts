import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { StellarResponseInterceptor } from './stellar-response.interceptor';

describe('StellarResponseInterceptor', () => {
  it('wraps stellar responses with standardized metadata', async () => {
    const interceptor = new StellarResponseInterceptor({
      getNetworkContext: () => ({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    } as never);

    const req = {
      method: 'POST',
      originalUrl: '/api/v1/nfts/mint',
      route: { path: '/nfts/mint' },
      body: { contractId: 'C123', transactionHash: 'abc123' },
      query: {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ tokenId: 'token-1', txHash: 'abc123' }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));
    const wrapped = result as Record<string, unknown>;

    expect(wrapped.ok).toBe(true);
    expect(wrapped.data).toEqual({ tokenId: 'token-1', txHash: 'abc123' });

    const meta = wrapped.stellarMeta as Record<string, unknown>;
    expect(meta.network).toBe('testnet');
    expect(meta.transactionHash).toBe('abc123');
    expect(meta.contractId).toBe('C123');
  });
});
