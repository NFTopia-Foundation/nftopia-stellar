use crate::error::TransactionError;
use crate::types::TransactionState;

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
