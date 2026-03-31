//! Time manager — thin wrappers around `env.ledger().timestamp()` with
//! helper predicates used across the transaction lifecycle.

use soroban_sdk::Env;

/// Returns the current ledger timestamp in seconds (Unix epoch).
pub fn now(env: &Env) -> u64 {
    env.ledger().timestamp()
}

/// Returns true when `deadline` has already passed.
pub fn is_expired(deadline: u64, env: &Env) -> bool {
    now(env) >= deadline
}

/// Returns true when `deadline` is still in the future.
pub fn is_future(deadline: u64, env: &Env) -> bool {
    deadline > now(env)
}

/// Calculate the deadline timestamp given an offset in seconds from now.
pub fn deadline_from_now(offset_secs: u64, env: &Env) -> u64 {
    now(env).saturating_add(offset_secs)
}

/// Assert that a timeout has not yet expired, returning an error otherwise.
pub fn assert_not_expired(deadline: u64, env: &Env) -> Result<(), crate::error::TransactionError> {
    if is_expired(deadline, env) {
        return Err(crate::error::TransactionError::OperationTimedOut);
    }
    Ok(())
}
