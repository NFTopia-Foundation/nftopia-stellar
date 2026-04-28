use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::storage::{DataKey, MAX_BATCH_SIZE, MAX_SUPPLY_HARD_CAP};
use crate::transfer;
use crate::types::{CollectionConfig, RoyaltyInfo, TokenAttribute, TokenData};
use soroban_sdk::{Address, Env, String, Vec};

fn next_token_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(1u64);
    env.storage()
        .instance()
        .set(&DataKey::NextTokenId, &(id + 1));
    id
}

fn check_supply(env: &Env) -> Result<(), ContractError> {
    let config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);

    if let Some(max) = config.max_supply
        && total >= max
    {
        return Err(ContractError::SupplyLimitExceeded);
    }
    Ok(())
}

fn mint_one(
    env: &Env,
    caller: &Address,
    to: &Address,
    metadata_uri: String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
) -> Result<u64, ContractError> {
    check_supply(env)?;

    let token_id = next_token_id(env);
    let default_royalty: RoyaltyInfo = env
        .storage()
        .instance()
        .get(&DataKey::DefaultRoyalty)
        .unwrap_or(RoyaltyInfo {
            recipient: caller.clone(),
            percentage: 0,
        });

    let royalty = royalty_override.unwrap_or(default_royalty);

    let data = TokenData {
        id: token_id,
        owner: to.clone(),
        metadata_uri,
        created_at: env.ledger().timestamp(),
        creator: caller.clone(),
        royalty_percentage: royalty.percentage,
        royalty_recipient: royalty.recipient,
        attributes,
        edition_number: None,
        total_editions: None,
    };

    env.storage()
        .persistent()
        .set(&DataKey::TokenData(token_id), &data);
    env.storage()
        .persistent()
        .set(&DataKey::TokenOwner(token_id), to);

    let bal: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Balance(to.clone()), &(bal + 1));

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::TotalSupply, &(total + 1));

    events::emit_mint(env, to.clone(), token_id);
    Ok(token_id)
}

pub fn mint(
    env: &Env,
    caller: &Address,
    to: Address,
    metadata_uri: String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
) -> Result<u64, ContractError> {
    access_control::require_minter(env, caller)?;

    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(ContractError::ContractPaused);
    }

    mint_one(env, caller, &to, metadata_uri, attributes, royalty_override)
}

pub fn batch_mint(
    env: &Env,
    caller: &Address,
    recipients: Vec<Address>,
    metadata_uris: Vec<String>,
    attributes: Vec<Vec<TokenAttribute>>,
) -> Result<Vec<u64>, ContractError> {
    access_control::require_minter(env, caller)?;

    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(ContractError::ContractPaused);
    }

    let n = recipients.len();
    if n != metadata_uris.len() || n != attributes.len() {
        return Err(ContractError::MismatchedArrays);
    }
    if n == 0 || n > MAX_BATCH_SIZE {
        return Err(ContractError::BatchTooLarge);
    }

    // Check total supply headroom up front
    let config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;
    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    if let Some(max) = config.max_supply
        && total + n as u64 > max
    {
        return Err(ContractError::SupplyLimitExceeded);
    }
    if total + n as u64 > MAX_SUPPLY_HARD_CAP {
        return Err(ContractError::SupplyLimitExceeded);
    }

    let mut ids: Vec<u64> = Vec::new(env);
    for i in 0..n {
        let id = mint_one(
            env,
            caller,
            &recipients.get(i).unwrap(),
            metadata_uris.get(i).unwrap(),
            attributes.get(i).unwrap(),
            None,
        )?;
        ids.push_back(id);
    }
    Ok(ids)
}

pub fn burn(env: &Env, caller: &Address, token_id: u64) -> Result<(), ContractError> {
    let owner: Address = env
        .storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or(ContractError::TokenNotFound)?;

    // Owner can always burn; burner role required for others
    if caller != &owner {
        access_control::require_burner(env, caller)?;
    }

    env.storage()
        .persistent()
        .remove(&DataKey::TokenOwner(token_id));
    env.storage()
        .persistent()
        .remove(&DataKey::TokenData(token_id));
    env.storage()
        .persistent()
        .remove(&DataKey::TokenApproved(token_id));

    let bal: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(owner.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Balance(owner.clone()), &bal.saturating_sub(1));

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::TotalSupply, &total.saturating_sub(1));

    events::emit_burn(env, owner, token_id);
    Ok(())
}

pub fn transfer(
    env: &Env,
    caller: &Address,
    from: Address,
    to: Address,
    token_id: u64,
) -> Result<(), ContractError> {
    if !transfer::is_approved_or_owner(env, caller, token_id) {
        return Err(ContractError::NotApproved);
    }
    transfer::do_transfer(env, &from, &to, token_id)
}

pub fn safe_transfer_from(
    env: &Env,
    caller: &Address,
    from: Address,
    to: Address,
    token_id: u64,
) -> Result<(), ContractError> {
    if !transfer::is_approved_or_owner(env, caller, token_id) {
        return Err(ContractError::NotApproved);
    }
    transfer::do_transfer(env, &from, &to, token_id)
}

pub fn batch_transfer(
    env: &Env,
    caller: &Address,
    from: Address,
    to: Address,
    token_ids: Vec<u64>,
) -> Result<(), ContractError> {
    let n = token_ids.len();
    if n == 0 || n > MAX_BATCH_SIZE {
        return Err(ContractError::BatchTooLarge);
    }

    for i in 0..n {
        let token_id = token_ids.get(i).unwrap();
        if !transfer::is_approved_or_owner(env, caller, token_id) {
            return Err(ContractError::NotApproved);
        }
        transfer::do_transfer(env, &from, &to, token_id)?;
    }
    Ok(())
}

pub fn owner_of(env: &Env, token_id: u64) -> Result<Address, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or(ContractError::TokenNotFound)
}

pub fn balance_of(env: &Env, owner: &Address) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(owner.clone()))
        .unwrap_or(0)
}

pub fn total_supply(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}
