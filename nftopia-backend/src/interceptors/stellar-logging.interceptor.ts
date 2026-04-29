import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { tap, type Observable } from 'rxjs';
import { getStellarConfig } from '../config/stellar.config';
import { SorobanRpcService } from '../services/soroban-rpc.service';
import {
  asHttpRequest,
  extractStellarResponseMeta,
  inferStellarContext,
} from './stellar.interceptor.utils';

@Injectable()
export class StellarLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StellarLoggingInterceptor.name);

  constructor(private readonly sorobanRpcService: SorobanRpcService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = asHttpRequest(context.switchToHttp().getRequest<unknown>());
    if (!req) {
      return next.handle();
    }

    const startedAt = Date.now();
    const requestContext = inferStellarContext(req);

    if (!requestContext.isStellarRequest) {
      return next.handle();
    }

    const config = getStellarConfig(process.env);
    const level = config.loggingLevel;

    const inboundSummary = {
      method: req.method,
      endpoint: requestContext.endpoint,
      contractId: requestContext.contractId || null,
      sorobanMethod: requestContext.method || null,
      txHash: requestContext.txHash || null,
      xdr: requestContext.xdr || null,
    };

    if (level === 'debug') {
      this.logger.debug(
        `Stellar inbound request: ${JSON.stringify(inboundSummary)}`,
      );
    } else {
      this.logger.log(
        `Stellar tx request ${req.method} ${requestContext.endpoint} tx=${requestContext.txHash || 'n/a'}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startedAt;
          const responseMeta = extractStellarResponseMeta(data);
          const requestKind = this.sorobanRpcService.inferRequestKind(
            requestContext.method,
          );
          const threshold =
            this.sorobanRpcService.getTimeoutThreshold(requestKind);

          const outboundSummary = {
            endpoint: requestContext.endpoint,
            contractId:
              responseMeta.contractId || requestContext.contractId || null,
            sorobanMethod: requestContext.method || null,
            txHash: responseMeta.txHash || requestContext.txHash || null,
            durationMs: duration,
            timeoutThresholdMs: threshold,
            status: responseMeta.status || 'success',
          };

          if (level === 'debug') {
            this.logger.debug(
              `Stellar outbound response: ${JSON.stringify(outboundSummary)}`,
            );
          } else {
            this.logger.log(
              `Stellar tx response endpoint=${requestContext.endpoint} tx=${outboundSummary.txHash || 'n/a'} duration=${duration}ms`,
            );
          }
        },
      }),
    );
  }
}
