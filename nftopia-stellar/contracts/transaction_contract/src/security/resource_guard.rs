//! Resource guard — enforces hard limits on transaction size and operation
//! depth to prevent infinite loops, stack overflows, and ledger-entry bloat.

use crate::error::TransactionError;
use soroban_sdk::Env;

/// Maximum number of operations allowed in a single transaction.
pub const MAX_OPERATIONS: u32 = 50;

/// Maximum dependency chain depth (prevents cycle-like deep chains).
pub const MAX_DEPENDENCY_DEPTH: u32 = 10;

/// Maximum number of parameters per operation.
pub const MAX_PARAMS_PER_OP: u32 = 20;

/// Maximum number of transactions in a batch call.
pub const MAX_BATCH_SIZE: u32 = 10;

/// Enforced gas ceiling per transaction when no override is provided.
pub const DEFAULT_GAS_CEILING: u64 = 100_000;

pub fn check_operation_count(count: u32, _env: &Env) -> Result<(), TransactionError> {
    if count > MAX_OPERATIONS {
        return Err(TransactionError::ResourceLimitExceeded);
    }
    Ok(())
}

pub fn check_param_count(count: u32, _env: &Env) -> Result<(), TransactionError> {
    if count > MAX_PARAMS_PER_OP {
        return Err(TransactionError::ResourceLimitExceeded);
    }
    Ok(())
}

pub fn check_batch_size(count: u32, _env: &Env) -> Result<(), TransactionError> {
    if count > MAX_BATCH_SIZE {
        return Err(TransactionError::ResourceLimitExceeded);
    }
    Ok(())
}

pub fn check_gas_ceiling(used: u64, ceiling: u64, _env: &Env) -> Result<(), TransactionError> {
    if used > ceiling {
        return Err(TransactionError::GasLimitExceeded);
    }
    Ok(())
}
