//! Pre-execution validation engine. Every transaction is subjected to a
//! set of preflight checks before the execution engine is allowed to proceed.

use crate::error::TransactionError;
use crate::types::{Operation, Transaction, TransactionState};
use soroban_sdk::Env;

/// Run all preflight checks against a transaction.  Returns the first
/// encountered error, or `Ok(())` when the transaction is safe to execute.
pub fn preflight(env: &Env, tx: &Transaction) -> Result<(), TransactionError> {
    check_state(tx)?;
    check_not_empty(tx)?;
    check_operation_ids_unique(env, tx)?;
    check_dependencies_in_scope(env, tx)?;
    Ok(())
}

/// The transaction must be in `Draft` or `Pending` state to execute.
fn check_state(tx: &Transaction) -> Result<(), TransactionError> {
    match &tx.state {
        TransactionState::Draft | TransactionState::Pending => Ok(()),
        TransactionState::Completed
        | TransactionState::Cancelled
        | TransactionState::RolledBack => Err(TransactionError::AlreadyFinalized),
        _ => Err(TransactionError::InvalidStateTransition),
    }
}

/// An empty transaction has nothing to execute.
fn check_not_empty(tx: &Transaction) -> Result<(), TransactionError> {
    if tx.operations.is_empty() {
        return Err(TransactionError::InvalidOperation);
    }
    Ok(())
}

/// Every operation_id must be non-zero and unique within the transaction.
fn check_operation_ids_unique(_env: &Env, tx: &Transaction) -> Result<(), TransactionError> {
    // We iterate O(n²) which is acceptable for the small operation counts
    // typical in a single Soroban transaction.
    let ops = &tx.operations;
    for i in 0..ops.len() {
        let id_i = ops.get(i).unwrap().operation_id;
        if id_i == 0 {
            return Err(TransactionError::InvalidOperation);
        }
        for j in (i + 1)..ops.len() {
            if id_i == ops.get(j).unwrap().operation_id {
                return Err(TransactionError::DuplicateOperationId);
            }
        }
    }
    Ok(())
}

/// Every dependency ID must reference an operation that also exists in the
/// same transaction (forward or backward).
fn check_dependencies_in_scope(_env: &Env, tx: &Transaction) -> Result<(), TransactionError> {
    let ops = &tx.operations;
    let mut known_ids: soroban_sdk::Vec<u64> = soroban_sdk::Vec::new(ops.env());
    for op in ops.iter() {
        known_ids.push_back(op.operation_id);
    }
    for op in ops.iter() {
        for dep_id in op.dependencies.iter() {
            if !known_ids.contains(dep_id) {
                return Err(TransactionError::DependencyNotMet);
            }
        }
    }
    Ok(())
}

/// Check a single operation for basic validity.
pub fn validate_operation(_env: &Env, op: &Operation) -> Result<(), TransactionError> {
    if op.operation_id == 0 {
        return Err(TransactionError::InvalidOperation);
    }
    if op.timeout_seconds == 0 {
        return Err(TransactionError::InvalidOperation);
    }
    Ok(())
}
