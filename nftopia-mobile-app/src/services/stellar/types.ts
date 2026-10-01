export interface Wallet {
  publicKey: string;
  secretKey: string;
  mnemonic?: string;
  backupConfirmed?: boolean;
}

export interface WalletCreateResult {
  wallet: Wallet;
  mnemonic: string;
}

export interface EncryptedWallet {
  data: string;
  iv: string;
  salt: string;
}

export enum TransactionType {
  PAYMENT = 'payment',
  PATH_PAYMENT = 'path_payment',
  CREATE_ACCOUNT = 'create_account',
  MANAGE_SELL_OFFER = 'manage_sell_offer',
  MANAGE_BUY_OFFER = 'manage_buy_offer',
  SET_OPTIONS = 'set_options',
  CHANGE_TRUST = 'change_trust',
  ALLOW_TRUST = 'allow_trust',
  ACCOUNT_MERGE = 'account_merge',
  INFLATION = 'inflation',
  MANAGE_DATA = 'manage_data',
  BUMP_SEQUENCE = 'bump_sequence',
  CLAWBACK = 'clawback',
  CLAWBACK_CLAIMABLE_BALANCE = 'clawback_claimable_balance',
  BEGIN_SPONSORING_FUTURE_RESERVES = 'begin_sponsoring_future_reserves',
  END_SPONSORING_FUTURE_RESERVES = 'end_sponsoring_future_reserves',
  REVOKE_SPONSORSHIP = 'revoke_sponsorship',
  LIQUIDITY_POOL_DEPOSIT = 'liquidity_pool_deposit',
  LIQUIDITY_POOL_WITHDRAW = 'liquidity_pool_withdraw',
  UNKNOWN = 'unknown',
}

export interface Transaction {
  id: string;
  hash: string;
  createdAt: string;
  sourceAccount: string;
  type: TransactionType;
  // Horizon operation records do not carry a ledger sequence; only
  // transaction-level responses do.
  ledger?: number;
  amount?: string;
  asset?: string;
  from?: string;
  to?: string;
  memo?: string;
  fee: number;
  successful: boolean;
}

export interface TransactionFilters {
  type?: TransactionType;
  dateFrom?: Date;
  dateTo?: Date;
  asset?: string;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  nextPage?: string;
  hasMore: boolean;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: WalletErrorCode,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export enum WalletErrorCode {
  INVALID_SECRET_KEY = 'INVALID_SECRET_KEY',
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  SIGN_ERROR = 'SIGN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  INSUFFICIENT_RESERVE = 'INSUFFICIENT_RESERVE',
}
