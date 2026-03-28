import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { throwError } from 'rxjs';
import { StellarErrorInterceptor } from './stellar-error.interceptor';

describe('StellarErrorInterceptor', () => {
  it('maps insufficient balance errors to payment required status', (done) => {
    const interceptor = new StellarErrorInterceptor({
      getNetworkContext: () => ({
        network: 'testnet',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    } as never);

    const req = {
      originalUrl: '/api/v1/auth/wallet/verify',
      route: { path: '/auth/wallet/verify' },
      body: {},
      query: {},
    };

    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () =>
        throwError(() => {
          const err = new Error(
            'insufficient balance for fee-bump transaction',
          );
          err.name = 'InsufficientBalanceError';
          return err;
        }),
    };

    interceptor.intercept(context, next).subscribe({
      error: (error: unknown) => {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);

        const response = httpError.getResponse() as Record<string, unknown>;
        const errorBody = response.error as Record<string, unknown>;
        expect(errorBody.code).toBe('INSUFFICIENT_BALANCE');
        done();
      },
    });
  });
});
