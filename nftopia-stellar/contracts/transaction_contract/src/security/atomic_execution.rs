//! Atomic execution ensures that all operations in a transaction either fully
//! complete or are fully rolled back. On Soroban each contract invocation is
//! already atomic within a single ledger, so this module provides the
//! bookkeeping layer that tracks in-flight state and decides whether to commit
//! or discard changes at the transaction-coordinator level.

use crate::error::TransactionError;
use crate::types::{OperationResult, TransactionState};
use soroban_sdk::{Env, Vec};

/// Validates that the execution result set represents a complete success —
/// every operation succeeded with no errors.
pub fn all_operations_succeeded(results: &Vec<OperationResult>) -> bool {
    for r in results.iter() {
        if !r.success {
            return false;
        }
    }
    true
}

/// Determines the final transaction state from a set of operation results.
/// Returns `Completed` only when every operation succeeded; otherwise
/// `PartiallyComplete` when some succeeded, or `Failed` when none did.
pub fn resolve_final_state(
    results: &Vec<OperationResult>,
    total_operations: u32,
) -> TransactionState {
    let succeeded = results.iter().filter(|r| r.success).count() as u32;
    match succeeded {
        n if n == total_operations => TransactionState::Completed,
        0 => TransactionState::Failed,
        _ => TransactionState::PartiallyComplete,
    }
}

/// Enforce "all-or-nothing" semantics: if the final state is not `Completed`
/// the caller should roll back any persisted side effects.
pub fn enforce_atomicity(
    _env: &Env,
    final_state: &TransactionState,
) -> Result<(), TransactionError> {
    match final_state {
        TransactionState::Completed => Ok(()),
        TransactionState::PartiallyComplete => Err(TransactionError::AtomicityViolation),
        _ => Err(TransactionError::AtomicityViolation),
    }
}
