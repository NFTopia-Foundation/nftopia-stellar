use soroban_sdk::{Address, Env, contractevent};

#[contractevent]
#[derive(Clone, Debug)]
pub struct Mint {
    pub to: Address,
    pub token_id: u64,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct Burn {
    pub from: Address,
    pub token_id: u64,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct Transfer {
    pub from: Address,
    pub to: Address,
    pub token_id: u64,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct Approval {
    pub owner: Address,
    pub approved: Address,
    pub token_id: u64,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct ApprovalForAll {
    pub owner: Address,
    pub operator: Address,
    pub approved: bool,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct MetadataUpdate {
    pub token_id: u64,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct RoyaltyUpdate {
    pub recipient: Address,
    pub percentage: u32,
}

pub fn emit_mint(env: &Env, to: Address, token_id: u64) {
    Mint { to, token_id }.publish(env);
}

pub fn emit_burn(env: &Env, from: Address, token_id: u64) {
    Burn { from, token_id }.publish(env);
}

pub fn emit_transfer(env: &Env, from: Address, to: Address, token_id: u64) {
    Transfer { from, to, token_id }.publish(env);
}

pub fn emit_approval(env: &Env, owner: Address, approved: Address, token_id: u64) {
    Approval {
        owner,
        approved,
        token_id,
    }
    .publish(env);
}

pub fn emit_approval_for_all(env: &Env, owner: Address, operator: Address, approved: bool) {
    ApprovalForAll {
        owner,
        operator,
        approved,
    }
    .publish(env);
}

pub fn emit_metadata_update(env: &Env, token_id: u64) {
    MetadataUpdate { token_id }.publish(env);
}

pub fn emit_royalty_update(env: &Env, recipient: Address, percentage: u32) {
    RoyaltyUpdate {
        recipient,
        percentage,
    }
    .publish(env);
}
