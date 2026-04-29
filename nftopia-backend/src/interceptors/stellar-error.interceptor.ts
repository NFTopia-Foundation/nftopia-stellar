import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, throwError, type Observable } from 'rxjs';
import { getStellarConfig } from '../config/stellar.config';
import { SorobanRpcService } from '../services/soroban-rpc.service';
import {
  asHttpRequest,
  inferStellarContext,
} from './stellar.interceptor.utils';

type ErrorMapping = {
  status: HttpStatus;
  code: string;
};

const ERROR_MAP: Record<string, ErrorMapping> = {
  SorobanRpcError: {
    status: HttpStatus.BAD_GATEWAY,
    code: 'SOROBAN_RPC_ERROR',
  },
  TransactionFailedError: {
    status: HttpStatus.BAD_REQUEST,
    code: 'STELLAR_TRANSACTION_FAILED',
  },
  InsufficientBalanceError: {
    status: HttpStatus.PAYMENT_REQUIRED,
    code: 'INSUFFICIENT_BALANCE',
  },
  InvalidSignatureError: {
    status: HttpStatus.UNAUTHORIZED,
    code: 'INVALID_SIGNATURE',
  },
  ContractError: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'SOROBAN_CONTRACT_ERROR',
  },
};

@Injectable()
export class StellarErrorInterceptor implements NestInterceptor {
  constructor(private readonly sorobanRpcService: SorobanRpcService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = asHttpRequest(context.switchToHttp().getRequest<unknown>());
    if (!req) {
      return next.handle();
    }

    const requestContext = inferStellarContext(req);

    return next.handle().pipe(
      catchError((error: unknown) => {
        if (!requestContext.isStellarRequest) {
          return throwError(() => error);
        }

        const config = getStellarConfig(process.env);
        const err = error as Error & {
          status?: number;
          code?: string;
          txHash?: string;
          contractId?: string;
          details?: unknown;
        };

        const mapped = this.resolveMapping(err);
        const networkContext = this.sorobanRpcService.getNetworkContext();
        const message = config.obfuscateSensitiveErrors
          ? this.sanitize(err.message)
          : err.message;

        return throwError(
          () =>
            new HttpException(
              {
                ok: false,
                error: {
                  code: mapped.code,
                  message,
                  details: config.obfuscateSensitiveErrors
                    ? undefined
                    : err.details || null,
                  stellar: {
                    transactionHash:
                      err.txHash || requestContext.txHash || null,
                    contractId:
                      err.contractId || requestContext.contractId || null,
                    network: networkContext.network,
                    sorobanRpcUrl: networkContext.sorobanRpcUrl,
                    networkPassphrase: networkContext.networkPassphrase,
                  },
                },
                timestamp: new Date().toISOString(),
              },
              mapped.status,
            ),
        );
      }),
    );
  }

  private resolveMapping(error: Error & { status?: number; code?: string }) {
    if (error.name && ERROR_MAP[error.name]) {
      return ERROR_MAP[error.name];
    }

    const text = `${error.name || ''} ${error.message || ''}`.toLowerCase();

    if (text.includes('insufficient balance')) {
      return ERROR_MAP.InsufficientBalanceError;
    }

    if (text.includes('invalid signature')) {
      return ERROR_MAP.InvalidSignatureError;
    }

    if (text.includes('contract') && text.includes('revert')) {
      return ERROR_MAP.ContractError;
    }

    if (text.includes('rpc') || text.includes('network')) {
      return ERROR_MAP.SorobanRpcError;
    }

    return {
      status:
        typeof error.status === 'number'
          ? (error.status as HttpStatus)
          : HttpStatus.INTERNAL_SERVER_ERROR,
      code: error.code || 'STELLAR_UNKNOWN_ERROR',
    };
  }

  private sanitize(value: string | undefined) {
    if (!value) {
      return 'A Stellar transaction error occurred';
    }

    return value
      .replace(/S[A-Z2-7]{55}/g, '[REDACTED_STELLAR_SEED]')
      .replace(/secret[^\s]*/gi, '[REDACTED_SECRET]')
      .replace(/private\s*key[^\s]*/gi, '[REDACTED_PRIVATE_KEY]');
  }
}
