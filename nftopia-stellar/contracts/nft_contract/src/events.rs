#![allow(deprecated)]
#![allow(unused_imports)]
use soroban_sdk::{Address, Env, symbol_short};

pub fn emit_mint(env: &Env, to: &Address, token_id: u64) {
    env.events().publish((symbol_short!("mint"), to), token_id);
}

pub fn emit_burn(env: &Env, token_id: u64) {
    env.events().publish((symbol_short!("burn"),), token_id);
}

pub fn emit_transfer(env: &Env, from: &Address, to: &Address, token_id: u64) {
    env.events()
        .publish((symbol_short!("transfer"), from, to), token_id);
}

pub fn emit_approval(env: &Env, owner: &Address, approved: &Address, token_id: u64) {
    env.events()
        .publish((symbol_short!("approve"), owner, approved), token_id);
}

pub fn emit_approval_for_all(env: &Env, owner: &Address, operator: &Address, approved: bool) {
    env.events()
        .publish((symbol_short!("appr_all"), owner, operator), approved);
}
