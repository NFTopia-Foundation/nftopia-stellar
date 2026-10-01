use crate::error::TransactionError;
use crate::types::TransactionState;

/// Number of ledgers a state transition may still be performed in once its
/// wall-clock deadline has been converted into ledger sequence numbers (#290).
///
/// Soroban exposes `ledger().sequence()` but *not* the network TTL settings to
/// contracts, so deadlines are always compared in ledger space.
pub const DEADLINE_SAFETY_MARGIN_LEDGERS: u64 = 10;

// Validate state transitions for the transaction lifecycle.
pub fn validate_transition(
    from: &TransactionState,
    to: &TransactionState,
) -> Result<(), TransactionError> {
    let valid = matches!(
        (from, to),
        (TransactionState::Draft, TransactionState::Pending)
            | (TransactionState::Draft, TransactionState::Executing)
            | (TransactionState::Draft, TransactionState::Cancelled)
            | (TransactionState::Pending, TransactionState::Executing)
            | (TransactionState::Pending, TransactionState::Cancelled)
            | (TransactionState::Executing, TransactionState::Completed)
            | (TransactionState::Executing, TransactionState::Failed)
            | (
                TransactionState::Executing,
                TransactionState::PartiallyComplete
            )
            | (TransactionState::Failed, TransactionState::Pending)
            | (TransactionState::Failed, TransactionState::RolledBack)
            | (TransactionState::Failed, TransactionState::Cancelled)
            | (
                TransactionState::PartiallyComplete,
                TransactionState::RolledBack
            )
            | (
                TransactionState::PartiallyComplete,
                TransactionState::Cancelled
            )
    );

    if valid {
        Ok(())
    } else {
        Err(TransactionError::InvalidStateTransition)
    }
}

pub fn is_final(state: &TransactionState) -> bool {
    matches!(
        state,
        TransactionState::Completed | TransactionState::Cancelled | TransactionState::RolledBack
    )
}

/// A *progressing* transition advances the workflow or records a successful
/// outcome. Terminal cleanups (cancel / rollback) are always allowed so that a
/// stuck transaction can still be put out of its misery after its deadline.
pub fn is_progressing(to: &TransactionState) -> bool {
    matches!(
        to,
        TransactionState::Pending
            | TransactionState::Executing
            | TransactionState::Completed
            | TransactionState::PartiallyComplete
    )
}

/// Convert a wall-clock (`timestamp`) deadline into ledger-sequence space.
///
/// Soroban contracts cannot read the network's average close time, so the
/// caller supplies the calibrated value carried by [`crate::dependency_resolver::TtlPolicy`].
/// The result is saturating: a deadline far in the future clamps to `u32::MAX`
/// rather than wrapping around into the past.
pub fn ledger_deadline(
    deadline_timestamp: u64,
    current_timestamp: u64,
    current_ledger: u32,
    avg_ledger_close_seconds: u64,
) -> u64 {
    if deadline_timestamp <= current_timestamp || avg_ledger_close_seconds == 0 {
        return current_ledger as u64;
    }
    let remaining_seconds = deadline_timestamp.saturating_sub(current_timestamp);
    let remaining_ledgers = remaining_seconds.saturating_div(avg_ledger_close_seconds);
    (current_ledger as u64).saturating_add(remaining_ledgers)
}

/// Validate a state transition against a ledger-sequence deadline (#290).
///
/// `deadline_ledger` is the ledger *height* by which the transition must have
/// been applied (as produced by [`ledger_deadline`]). Progressing transitions
/// that would be applied at or after that height are rejected with
/// [`TransactionError::OperationTimedOut`]; a [`DEADLINE_SAFETY_MARGIN_LEDGERS`]
/// buffer keeps a transition from landing in the very ledger that finalises the
/// window. Terminal transitions are never blocked by the deadline.
pub fn validate_transition_within_deadline(
    from: &TransactionState,
    to: &TransactionState,
    deadline_ledger: Option<u64>,
    current_ledger: u32,
) -> Result<(), TransactionError> {
    validate_transition(from, to)?;

    if let Some(deadline) = deadline_ledger
        && is_progressing(to)
        && (current_ledger as u64).saturating_add(DEADLINE_SAFETY_MARGIN_LEDGERS) > deadline
    {
        return Err(TransactionError::OperationTimedOut);
    }

    Ok(())
}
