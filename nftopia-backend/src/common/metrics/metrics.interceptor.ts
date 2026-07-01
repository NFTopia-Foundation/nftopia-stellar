import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { prometheus } from './prometheus';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();

    // Fall back to a strict Record type if Request brings hidden 'any' types
    const request = httpContext.getRequest<Request & Record<string, unknown>>();
    const response = httpContext.getResponse<Response>();

    const method = request.method ?? 'unknown';
    const url = request.url ?? '/';
    const endTimer = prometheus.startRequestTimer();

    // Safely extract the path without triggering an 'any' member access error
    let routePath: string | undefined;
    if (
      request.route &&
      typeof request.route === 'object' &&
      'path' in request.route
    ) {
      const routeObj = request.route as Record<string, unknown>;
      if (typeof routeObj.path === 'string') {
        routePath = routeObj.path;
      }
    }

    const route = routePath ?? url;

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode ?? 200;
        const duration = endTimer();

        prometheus.observeHttpRequestDuration(
          method,
          route,
          statusCode,
          duration,
        );
        prometheus.incrementHttpRequestsTotal(method, route, statusCode);
      }),
      catchError((error: unknown) => {
        let errorStatus = 500;
        if (error && typeof error === 'object' && 'status' in error) {
          const statusVal = (error as Record<string, unknown>).status;
          if (typeof statusVal === 'number') {
            errorStatus = statusVal;
          } else if (typeof statusVal === 'string') {
            errorStatus = parseInt(statusVal, 10) || 500;
          }
        }

        const statusCode = errorStatus;
        const duration = endTimer();

        prometheus.observeHttpRequestDuration(
          method,
          route,
          statusCode,
          duration,
        );
        prometheus.incrementHttpRequestsTotal(method, route, statusCode);
        prometheus.incrementHttpErrorsTotal(method, route, statusCode);

        return throwError(() => error);
      }),
    );
  }
}
