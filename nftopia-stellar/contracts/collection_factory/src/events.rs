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
