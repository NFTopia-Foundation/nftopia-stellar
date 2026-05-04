export enum TransactionState {
  DRAFT = 'draft',
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}
