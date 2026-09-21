//! Time manager — thin wrappers around `env.ledger().timestamp()` with
//! helper predicates used across the transaction lifecycle.
//!
//! In addition to wall-clock timestamps this module tracks ledger sequence
//! numbers so dependency resolution can validate Soroban TTL windows using
//! both block height and timestamp.

use soroban_sdk::Env;

use crate::error::TransactionError;

/// Mainnet minimum TTL for temporary storage entries, in ledgers.
pub const MAINNET_TEMP_MIN_TTL: u32 = 4_096;

/// Mainnet maximum TTL for persistent storage entries, in ledgers (~30 days).
pub const MAINNET_PERSISTENT_MAX_TTL: u32 = 518_400;

/// Average mainnet ledger close time in seconds.
pub const DEFAULT_LEDGER_CLOSE_SECONDS: u64 = 5;

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
pub fn assert_not_expired(deadline: u64, env: &Env) -> Result<(), TransactionError> {
    if is_expired(deadline, env) {
        return Err(TransactionError::OperationTimedOut);
    }
    Ok(())
}

// ── Ledger sequence tracking ─────────────────────────────────────────────────

/// Returns the current ledger sequence number.
pub fn current_ledger(env: &Env) -> u32 {
    env.ledger().sequence()
}

/// Returns the ledger sequence `offset` ledgers from now.
pub fn ledger_from_now(offset: u32, env: &Env) -> u32 {
    current_ledger(env).saturating_add(offset)
}

/// Returns how many ledgers have elapsed since `since_ledger`.
pub fn ledgers_elapsed(since_ledger: u32, env: &Env) -> u32 {
    current_ledger(env).saturating_sub(since_ledger)
}

/// Returns true when the ledger deadline has been reached or passed.
pub fn is_ledger_expired(deadline_ledger: u32, env: &Env) -> bool {
    current_ledger(env) >= deadline_ledger
}

/// Converts a duration in seconds into a whole number of ledgers, rounding up.
pub fn secs_to_ledgers(secs: u64, ledger_close_secs: u64) -> u32 {
    if ledger_close_secs == 0 {
        return u32::MAX;
    }
    let ledgers = secs.saturating_add(ledger_close_secs - 1) / ledger_close_secs;
    ledgers.min(u32::MAX as u64) as u32
}

/// Converts a number of ledgers into seconds using the configured close time.
pub fn ledgers_to_secs(ledgers: u32, ledger_close_secs: u64) -> u64 {
    (ledgers as u64).saturating_mul(ledger_close_secs)
}

/// Converts an operation timeout (seconds) into a ledger deadline.
pub fn deadline_ledger_from_now(timeout_secs: u64, env: &Env) -> u32 {
    ledger_from_now(
        secs_to_ledgers(timeout_secs, DEFAULT_LEDGER_CLOSE_SECONDS),
        env,
    )
}

/// Assert that `remaining_ttl_ledgers` covers the required execution window
/// plus the configured safety buffer. Returns `TTLExpired` otherwise.
pub fn assert_ttl_sufficient(
    remaining_ttl_ledgers: u32,
    required_ledgers: u32,
    min_remaining_ttl_buffer: u32,
) -> Result<(), TransactionError> {
    let needed = required_ledgers.saturating_add(min_remaining_ttl_buffer);
    if remaining_ttl_ledgers < needed {
        return Err(TransactionError::TTLExpired);
    }
    Ok(())
}
