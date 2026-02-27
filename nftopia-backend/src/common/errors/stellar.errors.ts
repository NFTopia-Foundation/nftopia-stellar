export class StellarError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SorobanRpcError extends StellarError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'SOROBAN_RPC_ERROR', metadata);
  }
}

export class TransactionFailedError extends StellarError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'TRANSACTION_FAILED_ERROR', metadata);
  }
}

export class InsufficientBalanceError extends StellarError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'INSUFFICIENT_BALANCE_ERROR', metadata);
  }
}

export class InvalidSignatureError extends StellarError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'INVALID_SIGNATURE_ERROR', metadata);
  }
}

export class ContractError extends StellarError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'CONTRACT_ERROR', metadata);
  }
}
