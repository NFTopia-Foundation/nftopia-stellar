import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { prometheus } from './prometheus';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, user } = request;
    const endTimer = prometheus.startRequestTimer(method, url);

    const route = request.route?.path || url;

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = response;
        const duration = endTimer();
        prometheus.observeHttpRequestDuration(method, route, statusCode, duration);
        prometheus.incrementHttpRequestsTotal(method, route, statusCode);
      }),
      catchError((error) => {
        const statusCode = error.status || 500;
        const duration = endTimer();
        prometheus.observeHttpRequestDuration(method, route, statusCode, duration);
        prometheus.incrementHttpRequestsTotal(method, route, statusCode);
        prometheus.incrementHttpErrorsTotal(method, route, statusCode);
        return throwError(() => error);
      }),
    );
  }
}