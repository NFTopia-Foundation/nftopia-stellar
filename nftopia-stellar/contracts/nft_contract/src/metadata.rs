use crate::access_control::require_role;
use crate::error::ContractError;
use crate::storage::DataKey;
use crate::types::{CollectionConfig, Role};
use soroban_sdk::{Env, String};

pub fn get_collection_config(env: &Env) -> Option<CollectionConfig> {
    env.storage().instance().get(&DataKey::CollectionConfig)
}

pub fn set_collection_config(
    env: &Env,
    config: &CollectionConfig,
    sender: &soroban_sdk::Address,
) -> Result<(), ContractError> {
    require_role(env, Role::Admin, sender)?;

    // If metadata is already frozen, block changes
    if let Some(existing) = get_collection_config(env)
        && existing.metadata_is_frozen {
            return Err(ContractError::NotPermitted);
        }
    env.storage()
        .instance()
        .set(&DataKey::CollectionConfig, config);
    Ok(())
}

pub fn freeze_metadata(env: &Env, sender: &soroban_sdk::Address) -> Result<(), ContractError> {
    require_role(env, Role::Admin, sender)?;
    if let Some(mut config) = get_collection_config(env) {
        config.metadata_is_frozen = true;
        env.storage()
            .instance()
            .set(&DataKey::CollectionConfig, &config);
        Ok(())
    } else {
        Err(ContractError::NotPermitted)
    }
}

pub fn get_token_uri(env: &Env, token_id: u64) -> Option<String> {
    env.storage().persistent().get(&DataKey::TokenURI(token_id))
}

pub fn set_token_uri(
    env: &Env,
    token_id: u64,
    uri: &String,
    sender: &soroban_sdk::Address,
) -> Result<(), ContractError> {
    require_role(env, Role::MetadataUpdater, sender)?;
    // Ensure metadata is not frozen
    if let Some(config) = get_collection_config(env)
        && config.metadata_is_frozen {
            return Err(ContractError::NotPermitted);
        }
    env.storage()
        .persistent()
        .set(&DataKey::TokenURI(token_id), uri);
    Ok(())
}
