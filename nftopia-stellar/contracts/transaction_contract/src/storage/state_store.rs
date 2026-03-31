//! State store — records the full state-transition history of every
//! transaction so auditors can reconstruct the exact lifecycle.

use crate::types::TransactionState;
use soroban_sdk::{Env, Vec, contracttype};

#[derive(Clone)]
#[contracttype]
enum StateStoreKey {
    History(u64), // keyed by transaction_id
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StateEntry {
    pub state: TransactionState,
    pub timestamp: u64,
}

fn load_history(env: &Env, tx_id: u64) -> Vec<StateEntry> {
    env.storage()
        .persistent()
        .get(&StateStoreKey::History(tx_id))
        .unwrap_or(Vec::new(env))
}

pub fn record_transition(env: &Env, tx_id: u64, new_state: TransactionState) {
    let mut history = load_history(env, tx_id);
    history.push_back(StateEntry {
        state: new_state,
        timestamp: env.ledger().timestamp(),
    });
    env.storage()
        .persistent()
        .set(&StateStoreKey::History(tx_id), &history);
}

pub fn get_history(env: &Env, tx_id: u64) -> Vec<StateEntry> {
    load_history(env, tx_id)
}
