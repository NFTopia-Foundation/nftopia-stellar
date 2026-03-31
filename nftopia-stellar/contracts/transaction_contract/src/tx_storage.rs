use soroban_sdk::{Address, Env, contracttype};

use crate::types::Transaction;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Transaction(u64),
    NextTxId,
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
