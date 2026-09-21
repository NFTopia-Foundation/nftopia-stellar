use soroban_sdk::{Address, Env, contracttype};

use crate::types::{NetworkFeeParams, Transaction};

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Transaction(u64),
    NextTxId,
    Admin,
    NetworkFeeParams,
    GasMultiplierBps,
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

// ── Admin & gas calibration configuration ───────────────────────────────────

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn set_fee_params(env: &Env, params: &NetworkFeeParams) {
    env.storage()
        .instance()
        .set(&DataKey::NetworkFeeParams, params);
}

pub fn load_fee_params(env: &Env) -> Option<NetworkFeeParams> {
    env.storage().instance().get(&DataKey::NetworkFeeParams)
}

pub fn set_gas_multiplier_bps(env: &Env, bps: u32) {
    env.storage()
        .instance()
        .set(&DataKey::GasMultiplierBps, &bps);
}

pub fn get_gas_multiplier_bps(env: &Env) -> Option<u32> {
    env.storage().instance().get(&DataKey::GasMultiplierBps)
}
