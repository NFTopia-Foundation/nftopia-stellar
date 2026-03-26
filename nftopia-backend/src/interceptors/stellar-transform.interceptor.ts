import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { StellarAccountService } from '../services/stellar-account.service';
import {
  asHttpRequest,
  getQueryString,
  inferStellarContext,
} from './stellar.interceptor.utils';

@Injectable()
export class StellarTransformInterceptor implements NestInterceptor {
  constructor(private readonly stellarAccountService: StellarAccountService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = asHttpRequest(context.switchToHttp().getRequest<unknown>());
    if (!req) {
      return next.handle();
    }

    const requestContext = inferStellarContext(req);

    if (!requestContext.isStellarRequest) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown): unknown => {
        const transformedAccount =
          this.stellarAccountService.transformAccountData(data);
        if (transformedAccount !== data) {
          return transformedAccount;
        }

        if (Array.isArray(data)) {
          const page = Number.parseInt(getQueryString(req, 'page') || '1', 10);
          const limit = Number.parseInt(
            getQueryString(req, 'limit') || `${data.length || 1}`,
            10,
          );

          return this.stellarAccountService.wrapCollectionResponse(
            data,
            page,
            limit,
            data.length,
          );
        }

        if (data && typeof data === 'object') {
          const record = data as Record<string, unknown>;
          const collection = record.data;
          if (Array.isArray(collection)) {
            const wrapped = this.stellarAccountService.wrapCollectionResponse(
              collection,
              Number(record.page || 1),
              Number(record.limit || collection.length || 1),
              Number(record.total || collection.length),
            );

            if (!wrapped || typeof wrapped !== 'object') {
              return data;
            }

            return {
              ...record,
              ...(wrapped as Record<string, unknown>),
            };
          }
        }

        return data;
      }),
    );
  }
}
