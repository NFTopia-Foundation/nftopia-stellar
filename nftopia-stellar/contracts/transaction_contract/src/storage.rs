use soroban_sdk::{Address, Env, Symbol, Vec, symbol_short};

use crate::types::Transaction;

const NEXT_TRANSACTION_ID: Symbol = symbol_short!("NEXT_TX");

pub fn next_transaction_id(env: &Env) -> u64 {
    let id = env.storage().instance().get::<_, u64>(&NEXT_TRANSACTION_ID).unwrap_or(1);
    env.storage().instance().set(&NEXT_TRANSACTION_ID, &(id + 1));
    id
}

fn tx_key(env: &Env, transaction_id: u64) -> Vec<u8> {
    let mut key = Vec::new(env);
    key.extend_from_slice(&transaction_id.to_be_bytes());
    key
}

pub fn save_transaction(env: &Env, tx: &Transaction) {
    let key = tx_key(env, tx.transaction_id);
    env.storage().persistent().set(&key, tx);
}

pub fn load_transaction(env: &Env, transaction_id: u64) -> Option<Transaction> {
    let key = tx_key(env, transaction_id);
    env.storage().persistent().get::<_, Transaction>(&key)
}

pub fn require_creator_auth(creator: &Address) {
    creator.require_auth();
}
