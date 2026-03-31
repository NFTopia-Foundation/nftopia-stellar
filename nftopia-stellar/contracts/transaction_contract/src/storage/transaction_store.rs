//! Persistent storage for `Transaction` structs, keyed by transaction ID.

use crate::error::TransactionError;
use crate::types::Transaction;
use soroban_sdk::{Env, Map, contracttype};

#[derive(Clone)]
#[contracttype]
enum TxStoreKey {
    All,
}

fn load_map(env: &Env) -> Map<u64, Transaction> {
    env.storage()
        .persistent()
        .get(&TxStoreKey::All)
        .unwrap_or(Map::new(env))
}

fn save_map(env: &Env, map: &Map<u64, Transaction>) {
    env.storage().persistent().set(&TxStoreKey::All, map);
}

pub fn put(env: &Env, tx: &Transaction) {
    let mut map = load_map(env);
    map.set(tx.transaction_id, tx.clone());
    save_map(env, &map);
}

pub fn get(env: &Env, id: u64) -> Option<Transaction> {
    load_map(env).get(id)
}

pub fn get_or_err(env: &Env, id: u64) -> Result<Transaction, TransactionError> {
    get(env, id).ok_or(TransactionError::TransactionNotFound)
}

pub fn remove(env: &Env, id: u64) {
    let mut map = load_map(env);
    map.remove(id);
    save_map(env, &map);
}
