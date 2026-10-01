import { Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

// #534: this service does no network/RPC calls itself (it's a pure
// response-shaping helper called by StellarTransformInterceptor on every
// response) — the blockchain RPC latency the issue is primarily about is
// captured in soroban-rpc.service.ts, which every real Horizon/Soroban call
// routes through. These spans exist so transform overhead is still visible
// as a named child span in a request's trace, distinct from RPC time.
const tracer = trace.getTracer('nftopia-backend.stellar-account');

@Injectable()
export class StellarAccountService {
  private readonly STROOPS_PER_XLM = 10_000_000;

  toXlmAmount(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return (parsed / this.STROOPS_PER_XLM).toFixed(7);
  }

  transformAccountData(payload: unknown): unknown {
    return tracer.startActiveSpan(
      'stellar_account.transform_account_data',
      (span) => {
        try {
          return this._transformAccountData(payload);
        } finally {
          span.end();
        }
      },
    );
  }

  private _transformAccountData(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const obj = payload as Record<string, unknown>;

    if (!Array.isArray(obj.balances) && !Array.isArray(obj.trustlines)) {
      return payload;
    }

    const balances = Array.isArray(obj.balances)
      ? (obj.balances as unknown[]).map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') {
            return entry;
          }

          const item = entry as Record<string, unknown>;
          return {
            ...item,
            amountXlm:
              typeof item.balance === 'string' ||
              typeof item.balance === 'number'
                ? this.toXlmAmount(item.balance)
                : null,
          };
        })
      : undefined;

    const trustlines = Array.isArray(obj.trustlines)
      ? (obj.trustlines as unknown[]).map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') {
            return entry;
          }

          const item = entry as Record<string, unknown>;
          return {
            ...item,
            limitXlm:
              typeof item.limit === 'string' || typeof item.limit === 'number'
                ? this.toXlmAmount(item.limit)
                : null,
          };
        })
      : undefined;

    return {
      ...obj,
      balances,
      trustlines,
    };
  }

  wrapCollectionResponse(
    data: unknown,
    page?: number,
    limit?: number,
    total?: number,
  ): unknown {
    return tracer.startActiveSpan(
      'stellar_account.wrap_collection_response',
      (span) => {
        try {
          return this._wrapCollectionResponse(data, page, limit, total);
        } finally {
          span.end();
        }
      },
    );
  }

  private _wrapCollectionResponse(
    data: unknown,
    page?: number,
    limit?: number,
    total?: number,
  ): unknown {
    if (!Array.isArray(data)) {
      return data;
    }

    const safeLimit =
      typeof limit === 'number' && limit > 0 ? limit : data.length || 1;
    const safePage = typeof page === 'number' && page > 0 ? page : 1;
    const safeTotal =
      typeof total === 'number' && total >= 0 ? total : data.length;

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: safeTotal,
        totalPages: Math.ceil(safeTotal / safeLimit),
      },
    };
  }
}
