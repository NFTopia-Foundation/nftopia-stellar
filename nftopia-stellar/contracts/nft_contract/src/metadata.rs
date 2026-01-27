use crate::access_control::AccessControl;
use crate::error::ContractError;
use crate::events::Events;
use crate::storage::Storage;
use crate::utils::Utils;
use soroban_sdk::{Address, Env, String as SorobanString};

pub struct Metadata;

impl Metadata {
    /// Get token URI (full URI including base URI if applicable)
    pub fn get_token_uri(env: &Env, token_id: u64) -> Result<SorobanString, ContractError> {
        let token = Storage::get_token(env, token_id).ok_or(ContractError::TokenNotFound)?;

        let config = Storage::get_config(env).ok_or(ContractError::ContractNotInitialized)?;

        if config.base_uri.len() == 0 {
            return Ok(token.metadata_uri);
        }
        let combined = Utils::combine_uri(env, &config.base_uri, &token.metadata_uri);
        Ok(combined)
    }

    /// Get token metadata (on-chain data)
    pub fn get_token_metadata(
        env: &Env,
        token_id: u64,
    ) -> Result<crate::token::TokenData, ContractError> {
        Storage::get_token(env, token_id).ok_or(ContractError::TokenNotFound)
    }

    /// Set token URI (owner or metadata updater only)
    pub fn set_token_uri(
        env: &Env,
        caller: &Address,
        token_id: u64,
        metadata_uri: SorobanString,
    ) -> Result<(), ContractError> {
        // Check if metadata is frozen
        let config = Storage::get_config(env).ok_or(ContractError::ContractNotInitialized)?;

        if config.metadata_is_frozen {
            return Err(ContractError::MetadataFrozen);
        }

        // Validate URI
        if metadata_uri.len() == 0 {
            return Err(ContractError::InvalidMetadataUri);
        }

        // Check permissions
        let token = Storage::get_token(env, token_id).ok_or(ContractError::TokenNotFound)?;

        if token.owner == *caller {
        } else if !Storage::is_metadata_updater(env, caller) {
            return Err(ContractError::Unauthorized);
        }

        // Update token metadata URI
        let mut updated_token = token.clone();
        updated_token.metadata_uri = metadata_uri.clone();
        Storage::set_token(env, token_id, &updated_token);

        // Emit event
        Events::emit_metadata_update(env, token_id, metadata_uri);

        Ok(())
    }

    /// Set base URI (admin only)
    pub fn set_base_uri(
        env: &Env,
        caller: &Address,
        base_uri: SorobanString,
    ) -> Result<(), ContractError> {
        AccessControl::require_admin(env, caller)?;

        let mut config = Storage::get_config(env).ok_or(ContractError::ContractNotInitialized)?;

        if config.metadata_is_frozen {
            return Err(ContractError::MetadataFrozen);
        }

        config.base_uri = base_uri.clone();
        Storage::set_config(env, &config);

        Events::emit_base_uri_update(env, base_uri);

        Ok(())
    }

    /// Freeze metadata permanently (admin only)
    pub fn freeze_metadata(env: &Env, caller: &Address) -> Result<(), ContractError> {
        AccessControl::require_admin(env, caller)?;

        let mut config = Storage::get_config(env).ok_or(ContractError::ContractNotInitialized)?;

        config.metadata_is_frozen = true;
        Storage::set_config(env, &config);

        Ok(())
    }

    /// Check if metadata is frozen
    pub fn is_metadata_frozen(env: &Env) -> Result<bool, ContractError> {
        let config = Storage::get_config(env).ok_or(ContractError::ContractNotInitialized)?;
        Ok(config.metadata_is_frozen)
    }
}
