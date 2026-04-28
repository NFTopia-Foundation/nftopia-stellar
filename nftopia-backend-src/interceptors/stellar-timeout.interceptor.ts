import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { catchError, throwError, timeout, type Observable } from 'rxjs';
import { SorobanRpcService } from '../services/soroban-rpc.service';
import {
  asHttpRequest,
  inferStellarContext,
} from './stellar.interceptor.utils';

@Injectable()
export class StellarTimeoutInterceptor implements NestInterceptor {
  constructor(private readonly sorobanRpcService: SorobanRpcService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = asHttpRequest(context.switchToHttp().getRequest<unknown>());
    if (!req) {
      return next.handle();
    }

    const requestContext = inferStellarContext(req);

    if (!requestContext.isStellarRequest) {
      return next.handle();
    }

    const requestKind = this.sorobanRpcService.inferRequestKind(
      requestContext.method,
    );
    const timeoutMs = this.sorobanRpcService.getTimeoutThreshold(requestKind);

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error: unknown) => {
        const err = error as Error & { name?: string };
        if (err?.name === 'TimeoutError') {
          return throwError(
            () =>
              new RequestTimeoutException({
                ok: false,
                error: {
                  code: 'SOROBAN_TIMEOUT',
                  message: `Soroban ${requestKind} request exceeded ${timeoutMs}ms timeout`,
                  stellar: {
                    endpoint: requestContext.endpoint || null,
                    method: requestContext.method || null,
                    contractId: requestContext.contractId || null,
                    transactionHash: requestContext.txHash || null,
                  },
                },
                timestamp: new Date().toISOString(),
              }),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
