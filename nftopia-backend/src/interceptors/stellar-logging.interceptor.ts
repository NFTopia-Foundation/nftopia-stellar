import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class StellarLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('StellarTx');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const now = Date.now();
    const method = req.method;
    const url = req.url;

    // We can infer Soroban specific activity based on endpoint routes
    const isStellarRoute = url.includes('/nft') || url.includes('/marketplace');

    if (isStellarRoute) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`[SorobanRPC] Incoming request: ${method} ${url}`);
      }
    }

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const delay = Date.now() - now;
          if (data && typeof data === 'object') {
            const txHash = data.transactionHash || data.meta?.transactionHash;
            const contractId = data.contractId || data.meta?.contractId;

            if (txHash || contractId) {
              this.logger.log(
                `[StellarTx] ${method} ${url} +${delay}ms - TX: ${txHash || 'N/A'} Contract: ${contractId || 'N/A'}`,
              );
            } else if (isStellarRoute) {
              this.logger.log(`[StellarCall] ${method} ${url} +${delay}ms`);
            }
          }
        },
        error: (error: any) => {
          const delay = Date.now() - now;
          this.logger.error(
            `[StellarError] ${method} ${url} +${delay}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
