//! Persistent storage for `Operation` structs, scoped to a parent
//! transaction ID. Operations are stored as a `Map<u64, Operation>` per
//! transaction to allow efficient indexed look-ups.

use crate::error::TransactionError;
use crate::types::Operation;
use soroban_sdk::{Env, Map, contracttype};

#[derive(Clone)]
#[contracttype]
enum OpStoreKey {
    Ops(u64), // keyed by transaction_id
}

fn load_ops(env: &Env, tx_id: u64) -> Map<u64, Operation> {
    env.storage()
        .persistent()
        .get(&OpStoreKey::Ops(tx_id))
        .unwrap_or(Map::new(env))
}

fn save_ops(env: &Env, tx_id: u64, map: &Map<u64, Operation>) {
    env.storage().persistent().set(&OpStoreKey::Ops(tx_id), map);
}

pub fn put(env: &Env, tx_id: u64, op: &Operation) {
    let mut map = load_ops(env, tx_id);
    map.set(op.operation_id, op.clone());
    save_ops(env, tx_id, &map);
}

pub fn get(env: &Env, tx_id: u64, op_id: u64) -> Option<Operation> {
    load_ops(env, tx_id).get(op_id)
}

pub fn get_or_err(env: &Env, tx_id: u64, op_id: u64) -> Result<Operation, TransactionError> {
    get(env, tx_id, op_id).ok_or(TransactionError::TransactionNotFound)
}

pub fn get_all(env: &Env, tx_id: u64) -> soroban_sdk::Vec<Operation> {
    let map = load_ops(env, tx_id);
    map.values()
}

/// Extend the TTL of the operation map of a transaction (#290).
///
/// Returns `false` when no operation has been stored for the transaction yet.
pub fn extend_ttl(env: &Env, tx_id: u64, threshold: u32, extend_to: u32) -> bool {
    let key = OpStoreKey::Ops(tx_id);
    if !env.storage().persistent().has(&key) {
        return false;
    }
    env.storage()
        .persistent()
        .extend_ttl(&key, threshold, extend_to);
    true
}

/// Whether a transaction owns a separate operation-map entry at all (#290).
///
/// Operations may live inside the `Transaction` record instead, in which case
/// there is no second entry whose liveness has to be guaranteed.
pub fn exists(env: &Env, tx_id: u64) -> bool {
    env.storage().persistent().has(&OpStoreKey::Ops(tx_id))
}
