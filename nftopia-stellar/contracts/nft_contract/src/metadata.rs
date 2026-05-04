use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use crate::types::TokenData;
use soroban_sdk::{Address, Env, String};

pub fn token_uri(env: &Env, token_id: u64) -> Result<String, ContractError> {
    let data: TokenData = env
        .storage()
        .persistent()
        .get(&DataKey::TokenData(token_id))
        .ok_or(ContractError::TokenNotFound)?;

    let base: Option<String> = env.storage().instance().get(&DataKey::BaseUri);
    if let Some(base_uri) = base
        && !base_uri.is_empty()
    {
        return Ok(base_uri);
    }
    Ok(data.metadata_uri)
}

pub fn token_metadata(env: &Env, token_id: u64) -> Result<TokenData, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenData(token_id))
        .ok_or(ContractError::TokenNotFound)
}

pub fn set_token_uri(
    env: &Env,
    caller: &Address,
    token_id: u64,
    uri: String,
) -> Result<(), ContractError> {
    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::MetadataFrozen)
        .unwrap_or(false)
    {
        return Err(ContractError::MetadataFrozen);
    }

    let owner: Address = env
        .storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or(ContractError::TokenNotFound)?;

    // Allow token owner OR a metadata-updater role
    let is_owner = caller == &owner;
    let has_role = access_control::require_metadata_updater(env, caller).is_ok();
    if !is_owner && !has_role {
        return Err(ContractError::NotAuthorized);
    }

    let mut data: TokenData = env
        .storage()
        .persistent()
        .get(&DataKey::TokenData(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    data.metadata_uri = uri;
    env.storage()
        .persistent()
        .set(&DataKey::TokenData(token_id), &data);

    events::emit_metadata_update(env, token_id);
    Ok(())
}

pub fn set_base_uri(env: &Env, caller: &Address, base_uri: String) -> Result<(), ContractError> {
    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::MetadataFrozen)
        .unwrap_or(false)
    {
        return Err(ContractError::MetadataFrozen);
    }
    access_control::require_admin_or_owner(env, caller);
    env.storage().instance().set(&DataKey::BaseUri, &base_uri);
    Ok(())
}

pub fn freeze_metadata(env: &Env, caller: &Address) -> Result<(), ContractError> {
    access_control::require_owner(env, caller);
    env.storage()
        .instance()
        .set(&DataKey::MetadataFrozen, &true);
    Ok(())
}

pub fn is_metadata_frozen(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<_, bool>(&DataKey::MetadataFrozen)
        .unwrap_or(false)
}
