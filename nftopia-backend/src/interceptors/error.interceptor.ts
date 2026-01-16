// src/interceptors/error.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        // Log the error for debugging purposes
        console.error('Error caught in interceptor:', err);

        // If the error is an instance of HttpException, extract the original status code
        if (err instanceof HttpException) {
          const statusCode = err.getStatus();  // Get the original status code
          const message = err.message || 'An error occurred';  // Extract the error message

          // Throw the same status code and message
          throw new HttpException(
            {
              statusCode: statusCode,
              message: message,
            },
            statusCode,
          );
        }

        // For any other errors (non-HttpExceptions), default to a 500 Internal Server Error
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Something went wrong, please try again later.',
            error: err.message || 'Internal Server Error',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }),
    );
  }
}
