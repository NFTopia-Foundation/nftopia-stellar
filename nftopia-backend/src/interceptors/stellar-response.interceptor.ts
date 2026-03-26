import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { SorobanRpcService } from '../services/soroban-rpc.service';
import {
  asHttpRequest,
  extractStellarResponseMeta,
  inferStellarContext,
} from './stellar.interceptor.utils';

@Injectable()
export class StellarResponseInterceptor implements NestInterceptor {
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

    const networkContext = this.sorobanRpcService.getNetworkContext();

    return next.handle().pipe(
      map((data: unknown): unknown => {
        if (data && typeof data === 'object' && 'stellarMeta' in data) {
          return data;
        }

        const responseMeta = extractStellarResponseMeta(data);

        return {
          ok: true,
          data,
          stellarMeta: {
            timestamp: new Date().toISOString(),
            network: networkContext.network,
            networkPassphrase: networkContext.networkPassphrase,
            sorobanRpcUrl: networkContext.sorobanRpcUrl,
            horizonUrl: networkContext.horizonUrl,
            transactionHash:
              responseMeta.txHash || requestContext.txHash || null,
            contractId:
              responseMeta.contractId || requestContext.contractId || null,
            method: requestContext.method || null,
            endpoint: requestContext.endpoint || null,
            xdr: responseMeta.xdr || requestContext.xdr || null,
            status: responseMeta.status || 'success',
          },
        };
      }),
    );
  }
}
