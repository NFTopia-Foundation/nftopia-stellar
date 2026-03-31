//! Error handler — maps internal `TransactionError` variants to
//! human-readable messages, and provides helpers for attaching contextual
//! detail when persisting error reasons in the `Transaction` struct.

use crate::error::TransactionError;
use soroban_sdk::{Env, String};

/// Convert a `TransactionError` into a short diagnostic `String` that can be
/// stored as `Transaction::error_reason`.
pub fn to_reason_string(env: &Env, err: &TransactionError) -> String {
    let msg = match err {
        TransactionError::TransactionNotFound => "transaction not found",
        TransactionError::Unauthorized => "caller not authorized",
        TransactionError::InvalidStateTransition => "invalid state transition",
        TransactionError::InvalidOperation => "invalid operation definition",
        TransactionError::DependencyNotMet => "operation dependency not satisfied",
        TransactionError::GasLimitExceeded => "gas limit exceeded",
        TransactionError::SignatureMissing => "required signature missing",
        TransactionError::AlreadyFinalized => "transaction already finalized",
        TransactionError::AtomicityViolation => "atomicity violation: partial completion",
        TransactionError::DuplicateOperationId => "duplicate operation id",
        TransactionError::ResourceLimitExceeded => "resource limit exceeded",
        TransactionError::OperationTimedOut => "operation timed out",
    };
    String::from_str(env, msg)
}
