use crate::error::TransactionError;
use crate::types::TransactionState;
use crate::utils::time_manager;
use soroban_sdk::Env;

// Validate state transitions for the transaction lifecycle.
pub fn validate_transition(
    from: &TransactionState,
    to: &TransactionState,
) -> Result<(), TransactionError> {
    if is_valid_transition(from, to) {
        Ok(())
    } else {
        Err(TransactionError::InvalidStateTransition)
    }
}

fn is_valid_transition(from: &TransactionState, to: &TransactionState) -> bool {
    matches!(
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
    )
}

pub fn is_final(state: &TransactionState) -> bool {
    matches!(
        state,
        TransactionState::Completed | TransactionState::Cancelled | TransactionState::RolledBack
    )
}

/// Returns true when `to` starts or resumes execution and therefore must be
/// checked against time/TTL constraints.
fn opens_execution_window(to: &TransactionState) -> bool {
    matches!(
        to,
        TransactionState::Pending
            | TransactionState::Executing
            | TransactionState::PartiallyComplete
    )
}

/// Validate a transition against the transaction's wall-clock expiry deadline.
///
/// Any transition that opens/resumes an execution window is rejected with
/// `OperationTimedOut` when `deadline` has already passed.
pub fn validate_transition_with_time(
    from: &TransactionState,
    to: &TransactionState,
    deadline: u64,
    env: &Env,
) -> Result<(), TransactionError> {
    validate_transition(from, to)?;
    if opens_execution_window(to) {
        time_manager::assert_not_expired(deadline, env)?;
    }
    Ok(())
}

/// Validate a transition against a ledger-height TTL deadline.
///
/// Any transition that opens/resumes an execution window is rejected with
/// `TTLExpired` when `deadline_ledger` has already been reached.
pub fn validate_transition_with_ledger(
    from: &TransactionState,
    to: &TransactionState,
    deadline_ledger: u32,
    env: &Env,
) -> Result<(), TransactionError> {
    validate_transition(from, to)?;
    if opens_execution_window(to) && time_manager::is_ledger_expired(deadline_ledger, env) {
        return Err(TransactionError::TTLExpired);
    }
    Ok(())
}

/// Validate a transition against both timestamp and ledger deadlines.
pub fn validate_transition_with_ttl(
    from: &TransactionState,
    to: &TransactionState,
    deadline: u64,
    deadline_ledger: u32,
    env: &Env,
) -> Result<(), TransactionError> {
    validate_transition_with_time(from, to, deadline, env)?;
    validate_transition_with_ledger(from, to, deadline_ledger, env)
}
