use crate::{errors::TransactionError, storage, types::*};
use soroban_sdk::Env;

pub fn cancel(env: &Env, transaction_id: u64) -> Result<(), TransactionError> {
    let mut tx = storage::get_transaction(env, transaction_id)?;

    if matches!(tx.state, TransactionState::Completed) {
        return Err(TransactionError::InvalidState);
    }

    tx.state = TransactionState::Cancelled;
    storage::save_transaction(env, &tx);
    Ok(())
}
