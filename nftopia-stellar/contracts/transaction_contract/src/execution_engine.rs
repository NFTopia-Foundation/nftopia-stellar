use crate::{errors::TransactionError, storage, types::*};
use soroban_sdk::Env;

pub fn execute(env: &Env, transaction_id: u64) -> Result<(), TransactionError> {
    let mut tx = storage::get_transaction(env, transaction_id)?;

    if !matches!(
        tx.state,
        TransactionState::Draft | TransactionState::Pending
    ) {
        return Err(TransactionError::InvalidState);
    }

    tx.state = TransactionState::Executing;
    storage::save_transaction(env, &tx);

    for _op in tx.operations.iter() {
        // TODO: cross-contract invocation
        // env.invoke_contract(...)
    }

    tx.state = TransactionState::Completed;
    storage::save_transaction(env, &tx);

    Ok(())
}
