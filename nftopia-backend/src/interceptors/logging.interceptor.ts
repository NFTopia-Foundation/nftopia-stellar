import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const method = request.method;
        const url = request.url;
        const status = response.statusCode;

        this.logger.log(
          `${method} ${url} ${status} - ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
