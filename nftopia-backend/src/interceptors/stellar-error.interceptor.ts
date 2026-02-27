import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  SorobanRpcError,
  TransactionFailedError,
  InsufficientBalanceError,
  InvalidSignatureError,
  ContractError,
} from '../common/errors/stellar.errors';

@Injectable()
export class StellarErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error: any) => {
        let safeMessage = error.message;
        if (safeMessage && typeof safeMessage === 'string') {
          // Redact Stellar secret seeds (starts with S and is 56 chars long)
          safeMessage = safeMessage.replace(
            /(S[A-Z0-9]{55})/g,
            '[REDACTED_SECRET]',
          );
        }

        if (error instanceof SorobanRpcError) {
          return throwError(
            () =>
              new BadGatewayException({
                message: safeMessage,
                code: error.code,
                ...error.metadata,
              }),
          );
        }
        if (error instanceof TransactionFailedError) {
          return throwError(
            () =>
              new BadRequestException({
                message: safeMessage,
                code: error.code,
                ...error.metadata,
              }),
          );
        }
        if (
          error instanceof InsufficientBalanceError ||
          error instanceof InvalidSignatureError ||
          error instanceof ContractError
        ) {
          return throwError(
            () =>
              new BadRequestException({
                message: safeMessage,
                code: error.code,
                ...error.metadata,
              }),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
