use soroban_sdk::{Address, Env, String, Symbol, symbol_short};

use crate::types::TransactionState;

const TX_EVENT: Symbol = symbol_short!("TX");

pub fn publish_created(env: &Env, transaction_id: u64, creator: &Address) {
    env.events().publish((TX_EVENT, symbol_short!("CREATED"), transaction_id), creator);
}

pub fn publish_state_changed(
    env: &Env,
    transaction_id: u64,
    from_state: &TransactionState,
    to_state: &TransactionState,
) {
    env.events().publish(
        (TX_EVENT, symbol_short!("STATE"), transaction_id),
        (from_state.clone(), to_state.clone()),
    );
}

pub fn publish_failed(env: &Env, transaction_id: u64, reason: &String) {
    env.events().publish((TX_EVENT, symbol_short!("FAILED"), transaction_id), reason.clone());
}
