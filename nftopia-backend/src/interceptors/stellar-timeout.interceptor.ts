import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StellarTimeoutInterceptor implements NestInterceptor {
  constructor(private configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const defaultTimeout =
      this.configService.get<number>('stellar.timeouts.rpcCall') || 30000;

    const req = context.switchToHttp().getRequest();
    const url = req.url;
    let timeoutMs = defaultTimeout;

    if (url.includes('/simulate')) {
      timeoutMs =
        this.configService.get<number>('stellar.timeouts.simulation') || 15000;
    } else if (url.includes('/submit')) {
      timeoutMs =
        this.configService.get<number>('stellar.timeouts.submission') || 45000;
    }

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err: any) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Stellar action timed out after ${timeoutMs}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
