use soroban_sdk::{Address, Env, contractevent};

#[contractevent]
#[derive(Clone, Debug)]
pub struct Created {
    pub creator: Address,
    pub collection: Address,
    pub id: u32,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct CollectionRegistered {
    pub factory: Address,
    pub collection: Address,
    pub registered_at: u64,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct Mint {
    pub collection: Address,
    pub to: Address,
    pub token_id: u32,
    pub amount: u32,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct Transfer {
    pub collection: Address,
    pub from: Address,
    pub to: Address,
    pub token_id: u32,
    pub amount: u32,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct Burn {
    pub collection: Address,
    pub from: Address,
    pub token_id: u32,
    pub amount: u32,
}

// New Event Structs for Issue #288

#[contractevent]
#[derive(Clone, Debug)]
pub struct MaxCollectionsUpdated {
    pub old_limit: u32,
    pub new_limit: u32,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct CreatorLimitExceededAttempt {
    pub creator: Address,
    pub current_count: u32,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct CollectionCountReset {
    pub creator: Address,
}

/* Emission Helpers */

pub fn emit_collection_created(
    env: &Env,
    creator: Address,
    collection_address: Address,
    collection_id: u32,
) {
    Created {
        creator,
        collection: collection_address,
        id: collection_id,
    }
    .publish(env);
}

pub fn emit_collection_registered(env: &Env, factory: Address, collection: Address) {
    CollectionRegistered {
        factory,
        collection,
        registered_at: env.ledger().timestamp(),
    }
    .publish(env);
}

pub fn emit_mint(env: &Env, collection: Address, to: Address, token_id: u32, amount: u32) {
    Mint {
        collection,
        to,
        token_id,
        amount,
    }
    .publish(env);
}

pub fn emit_transfer(
    env: &Env,
    collection: Address,
    from: Address,
    to: Address,
    token_id: u32,
    amount: u32,
) {
    Transfer {
        collection,
        from,
        to,
        token_id,
        amount,
    }
    .publish(env);
}

pub fn emit_burn(env: &Env, collection: Address, from: Address, token_id: u32, amount: u32) {
    Burn {
        collection,
        from,
        token_id,
        amount,
    }
    .publish(env);
}

// New Emission Helpers for Issue #288

pub fn emit_max_collections_updated(env: &Env, old_limit: u32, new_limit: u32) {
    MaxCollectionsUpdated {
        old_limit,
        new_limit,
    }
    .publish(env);
}

pub fn emit_creator_limit_exceeded_attempt(env: &Env, creator: Address, current_count: u32) {
    CreatorLimitExceededAttempt {
        creator,
        current_count,
    }
    .publish(env);
}

pub fn emit_collection_count_reset(env: &Env, creator: Address) {
    CollectionCountReset { creator }.publish(env);
}
