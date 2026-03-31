//! In-memory/instance-level cache for frequently accessed gas estimates.
//! Uses instance storage (short-lived, within a single invocation context)
//! to avoid redundant re-computation during batch operations.

use crate::types::GasEstimate;
use soroban_sdk::{Env, contracttype};

#[derive(Clone)]
#[contracttype]
enum CacheKey {
    GasEstimate(u64),
}

pub fn put_gas_estimate(env: &Env, tx_id: u64, estimate: &GasEstimate) {
    env.storage()
        .instance()
        .set(&CacheKey::GasEstimate(tx_id), estimate);
}

pub fn get_gas_estimate(env: &Env, tx_id: u64) -> Option<GasEstimate> {
    env.storage().instance().get(&CacheKey::GasEstimate(tx_id))
}

pub fn invalidate_gas_estimate(env: &Env, tx_id: u64) {
    env.storage()
        .instance()
        .remove(&CacheKey::GasEstimate(tx_id));
}
