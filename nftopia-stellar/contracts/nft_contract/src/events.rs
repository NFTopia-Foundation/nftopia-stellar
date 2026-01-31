use soroban_sdk::{Address, Env, contractevent};

/// Transfer event (ERC-721 equivalent).
#[contractevent]
#[derive(Clone, Debug)]
pub struct Transfer {
    pub from: Address,
    pub to: Address,
    pub token_id: u64,
}

/// Approval event.
#[contractevent]
#[derive(Clone, Debug)]
pub struct Approval {
    pub owner: Address,
    pub approved: Address,
    pub token_id: u64,
}

/// Operator approval for all tokens.
#[contractevent]
#[derive(Clone, Debug)]
pub struct ApprovalForAll {
    pub owner: Address,
    pub operator: Address,
    pub approved: bool,
}

/// Mint event.
#[contractevent]
#[derive(Clone, Debug)]
pub struct Mint {
    pub to: Address,
    pub token_id: u64,
    pub creator: Address,
}

/// Burn event.
#[contractevent]
#[derive(Clone, Debug)]
pub struct Burn {
    pub from: Address,
    pub token_id: u64,
}

/// Royalty info updated.
#[contractevent]
#[derive(Clone, Debug)]
pub struct RoyaltyUpdated {
    pub token_id: u64,
    pub recipient: Address,
    pub percentage: u32,
}

/// Metadata frozen.
#[contractevent]
#[derive(Clone, Debug)]
pub struct MetadataFrozen {
    pub by: Address,
}

/// Base URI updated.
#[contractevent]
#[derive(Clone, Debug)]
pub struct BaseUriUpdated {
    pub base_uri: soroban_sdk::String,
}

/// Token URI updated.
#[contractevent]
#[derive(Clone, Debug)]
pub struct TokenUriUpdated {
    pub token_id: u64,
    pub uri: soroban_sdk::String,
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

pub fn emit_mint(env: &Env, to: Address, token_id: u64, creator: Address) {
    Mint {
        to,
        token_id,
        creator,
    }
    .publish(env);
}

pub fn emit_burn(env: &Env, from: Address, token_id: u64) {
    Burn { from, token_id }.publish(env);
}

pub fn emit_royalty_updated(env: &Env, token_id: u64, recipient: Address, percentage: u32) {
    RoyaltyUpdated {
        token_id,
        recipient,
        percentage,
    }
    .publish(env);
}

pub fn emit_metadata_frozen(env: &Env, by: Address) {
    MetadataFrozen { by }.publish(env);
}

pub fn emit_base_uri_updated(env: &Env, base_uri: soroban_sdk::String) {
    BaseUriUpdated { base_uri }.publish(env);
}

pub fn emit_token_uri_updated(env: &Env, token_id: u64, uri: soroban_sdk::String) {
    TokenUriUpdated { token_id, uri }.publish(env);
}
