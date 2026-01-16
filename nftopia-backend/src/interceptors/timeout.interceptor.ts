import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';  // Import throwError from rxjs
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),  // Timeout after 5 seconds
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new Error('Request timed out')); 
        }
        return throwError(() => error);  //Rethrowing other errors
      }),
    );
  }
}

