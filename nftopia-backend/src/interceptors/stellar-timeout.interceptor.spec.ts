import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RequestTimeoutException } from '@nestjs/common';
import { throwError } from 'rxjs';
import { StellarTimeoutInterceptor } from './stellar-timeout.interceptor';

describe('StellarTimeoutInterceptor', () => {
  it('converts timeout errors into request timeout exceptions', (done) => {
    const interceptor = new StellarTimeoutInterceptor({
      inferRequestKind: () => 'simulation',
      getTimeoutThreshold: () => 1,
    } as never);

    const req = {
      originalUrl: '/api/v1/nfts',
      route: { path: '/nfts' },
      body: { method: 'simulateMint' },
      query: {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => {
        const err = new Error('timeout');
        err.name = 'TimeoutError';
        return throwError(() => err);
      },
    };

    interceptor.intercept(context, next).subscribe({
      error: (error: unknown) => {
        expect(error).toBeInstanceOf(RequestTimeoutException);
        done();
      },
    });
  });
});
