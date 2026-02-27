import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

export interface StellarResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    network: string;
    transactionHash?: string;
    contractId?: string;
  };
}

@Injectable()
export class StellarResponseInterceptor<T> implements NestInterceptor<
  T,
  StellarResponse<T>
> {
  constructor(private configService: ConfigService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StellarResponse<T>> {
    const network =
      this.configService.get<string>('stellar.network') || 'testnet';

    return next.handle().pipe(
      map((data) => {
        let txHash,
          contractId,
          actualData = data;

        if (data && typeof data === 'object') {
          if ('transactionHash' in data) {
            txHash = data.transactionHash;
          }
          if ('contractId' in data) {
            contractId = data.contractId;
          }
          // If the payload explicitly returned 'data' separate from metadata, use it. Otherwise, use the whole object.
          if ('data' in data && Object.keys(data).length <= 3) {
            // rudimentary check
            actualData = data.data;
          }
        }

        return {
          data: actualData,
          meta: {
            timestamp: new Date().toISOString(),
            network,
            ...(txHash && { transactionHash: txHash }),
            ...(contractId && { contractId }),
          },
        };
      }),
    );
  }
}
