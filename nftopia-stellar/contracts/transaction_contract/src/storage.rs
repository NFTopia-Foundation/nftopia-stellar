use crate::errors::TransactionError;
use crate::types::*;
use soroban_sdk::{Address, Bytes, Env, Map, Vec};

const TX_COUNTER: &str = "TX_COUNTER";
const TX_STORE: &str = "TX_STORE";

pub fn create_transaction(
    env: &Env,
    creator: Address,
    metadata: Map<Bytes, Bytes>,
    operations: Vec<Operation>,
) -> Result<u64, TransactionError> {
    let mut counter: u64 = env.storage().instance().get(&TX_COUNTER).unwrap_or(0);
    counter += 1;

    let tx = Transaction {
        id: counter,
        creator,
        operations,
        state: TransactionState::Draft,
        metadata,
    };

    env.storage().instance().set(&(TX_STORE, counter), &tx);
    env.storage().instance().set(&TX_COUNTER, &counter);

    Ok(counter)
}

pub fn add_operation(
    env: &Env,
    transaction_id: u64,
    operation: Operation,
) -> Result<(), TransactionError> {
    let mut tx: Transaction = env
        .storage()
        .instance()
        .get(&(TX_STORE, transaction_id))
        .ok_or(TransactionError::NotFound)?;

    if !matches!(tx.state, TransactionState::Draft) {
        return Err(TransactionError::InvalidState);
    }

    tx.operations.push_back(operation);
    env.storage()
        .instance()
        .set(&(TX_STORE, transaction_id), &tx);
    Ok(())
}

pub fn get_transaction(env: &Env, id: u64) -> Result<Transaction, TransactionError> {
    env.storage()
        .instance()
        .get(&(TX_STORE, id))
        .ok_or(TransactionError::NotFound)
}

pub fn save_transaction(env: &Env, tx: &Transaction) {
    env.storage().instance().set(&(TX_STORE, tx.id), tx);
}

pub fn get_state(env: &Env, id: u64) -> Result<TransactionState, TransactionError> {
    Ok(get_transaction(env, id)?.state)
}
