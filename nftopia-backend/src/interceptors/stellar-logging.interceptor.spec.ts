import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { StellarLoggingInterceptor } from './stellar-logging.interceptor';

describe('StellarLoggingInterceptor', () => {
  it('passes through non-stellar requests untouched', async () => {
    const interceptor = new StellarLoggingInterceptor({
      inferRequestKind: () => 'default',
      getTimeoutThreshold: () => 30_000,
    } as never);

    const req = {
      method: 'GET',
      originalUrl: '/api/v1/users',
      route: { path: '/users' },
      body: {},
      query: {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));
    expect(result).toEqual({ ok: true });
  });
});
