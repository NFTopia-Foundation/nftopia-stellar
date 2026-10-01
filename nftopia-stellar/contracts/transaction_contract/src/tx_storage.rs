use soroban_sdk::{Address, Env, contracttype};

use crate::types::Transaction;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Transaction(u64),
    NextTxId,
    ConfigAuthority,
}

/// The address allowed to refresh the contract-wide network mirror (fee ladder
/// and TTL policy). Set once at deploy time (#291).
pub fn config_authority(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::ConfigAuthority)
}

pub fn set_config_authority(env: &Env, authority: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::ConfigAuthority, authority);
}

pub fn next_transaction_id(env: &Env) -> u64 {
    let id = env
        .storage()
        .instance()
        .get::<_, u64>(&DataKey::NextTxId)
        .unwrap_or(1);
    env.storage().instance().set(&DataKey::NextTxId, &(id + 1));
    id
}

pub fn save_transaction(env: &Env, tx: &Transaction) {
    env.storage()
        .persistent()
        .set(&DataKey::Transaction(tx.transaction_id), tx);
}

pub fn load_transaction(env: &Env, transaction_id: u64) -> Option<Transaction> {
    env.storage()
        .persistent()
        .get(&DataKey::Transaction(transaction_id))
}

pub fn require_creator_auth(creator: &Address) {
    creator.require_auth();
}

/// Extend the TTL of a transaction record (#290).
///
/// `threshold == extend_to` makes the call idempotent and guarantees at least
/// `extend_to` remaining ledgers, whichever branch the host takes. Returns
/// `false` when the record does not exist (anymore).
pub fn extend_transaction_ttl(
    env: &Env,
    transaction_id: u64,
    threshold: u32,
    extend_to: u32,
) -> bool {
    let key = DataKey::Transaction(transaction_id);
    if !env.storage().persistent().has(&key) {
        return false;
    }
    env.storage()
        .persistent()
        .extend_ttl(&key, threshold, extend_to);
    true
}
