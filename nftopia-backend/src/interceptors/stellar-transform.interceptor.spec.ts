import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { StellarTransformInterceptor } from './stellar-transform.interceptor';

describe('StellarTransformInterceptor', () => {
  it('transforms balances and wraps list responses', async () => {
    const interceptor = new StellarTransformInterceptor({
      transformAccountData: (data: unknown) => {
        const value = data as Record<string, unknown>;
        if (Array.isArray(value.balances)) {
          return {
            ...value,
            balances: [{ balance: '10000000', amountXlm: '1.0000000' }],
          };
        }

        return data;
      },
      wrapCollectionResponse: (
        data: unknown,
        page = 1,
        limit = 10,
        total = 0,
      ) => ({
        data,
        pagination: { page, limit, total },
      }),
    } as never);

    const req = {
      originalUrl: '/api/v1/auth/wallet/account',
      route: { path: '/auth/wallet/account' },
      body: {},
      query: { page: '1', limit: '10' },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ balances: [{ balance: '10000000' }] }),
    };

    const transformed = await lastValueFrom(
      interceptor.intercept(context, next),
    );
    expect((transformed as Record<string, unknown>).balances).toEqual([
      { balance: '10000000', amountXlm: '1.0000000' },
    ]);
  });
});
