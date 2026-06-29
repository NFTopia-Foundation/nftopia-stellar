import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response as ExpressResponse, Request as ExpressRequest } from 'express';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();

    if (type === 'http') {
      const httpContext = context.switchToHttp();
      const request = httpContext.getRequest<ExpressRequest>();
      const response = httpContext.getResponse<ExpressResponse>();

      const correlationId =
        (request.headers['x-correlation-id'] as string) ||
        (request['correlationId'] as string) ||
        (request.headers['x-request-id'] as string) ||
        (request.id as string);

      if (correlationId && response) {
        if (typeof response.setHeader === 'function' && !response.headersSent && !response.getHeader('x-correlation-id')) {
          response.setHeader('x-correlation-id', correlationId);
        }
      }
    } else if ((type as string) === 'graphql') {
      // In GraphQL, context is typically the 3rd argument (info, args, context, info)
      const gqlContext = context.getArgByIndex(2);
      const req = gqlContext?.req;
      const res = gqlContext?.res;

      if (req && res) {
        const correlationId =
          (req.headers?.['x-correlation-id'] as string) ||
          (req.headers?.['x-request-id'] as string) ||
          req['correlationId'] ||
          req.id;

        if (correlationId) {
          if (typeof res.setHeader === 'function' && !res.headersSent && !res.getHeader('x-correlation-id')) {
            res.setHeader('x-correlation-id', correlationId);
          }
        }
      }
    }

    return next.handle();
  }
}
