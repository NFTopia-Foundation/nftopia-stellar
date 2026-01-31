use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use crate::types::{TokenAttribute, TokenMetadata};
use soroban_sdk::{Address, Env, String, Vec};

/// Returns the token metadata URI. For relative URIs, clients should combine with base_uri.
pub fn token_uri(env: &Env, token_id: u64) -> Result<String, ContractError> {
    env.storage()
        .instance()
        .get(&DataKey::TokenUri(token_id))
        .ok_or(ContractError::TokenNotFound)
}

/// Returns structured on-chain metadata for a token.
pub fn token_metadata(env: &Env, token_id: u64) -> Result<TokenMetadata, ContractError> {
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    let approved: Option<Address> = env.storage().instance().get(&DataKey::Approved(token_id));
    let metadata_uri: String = env
        .storage()
        .instance()
        .get(&DataKey::TokenUri(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    let created_at: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TokenCreatedAt(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    let creator: Address = env
        .storage()
        .instance()
        .get(&DataKey::TokenCreator(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    let royalty_bps: u32 = env
        .storage()
        .instance()
        .get(&DataKey::TokenRoyaltyBps(token_id))
        .unwrap_or_else(|| {
            let def: crate::types::RoyaltyInfo = env
                .storage()
                .instance()
                .get(&DataKey::DefaultRoyalty)
                .unwrap();
            def.percentage
        });
    let royalty_recipient: Address = env
        .storage()
        .instance()
        .get(&DataKey::TokenRoyaltyRecipient(token_id))
        .unwrap_or_else(|| {
            let def: crate::types::RoyaltyInfo = env
                .storage()
                .instance()
                .get(&DataKey::DefaultRoyalty)
                .unwrap();
            def.recipient
        });
    let attributes: Vec<TokenAttribute> = env
        .storage()
        .instance()
        .get(&DataKey::TokenAttributes(token_id))
        .unwrap_or_else(|| Vec::new(env));
    let edition_number: Option<u32> = env
        .storage()
        .instance()
        .get(&DataKey::TokenEditionNumber(token_id));
    let total_editions: Option<u32> = env
        .storage()
        .instance()
        .get(&DataKey::TokenTotalEditions(token_id));

    Ok(TokenMetadata {
        id: token_id,
        owner,
        approved,
        metadata_uri,
        created_at,
        creator,
        royalty_percentage: royalty_bps,
        royalty_recipient,
        attributes,
        edition_number,
        total_editions,
    })
}

/// Updates token URI. Requires owner or metadata updater role; fails if metadata is frozen.
pub fn set_token_uri(
    env: &Env,
    token_id: u64,
    uri: String,
    caller: &Address,
) -> Result<(), ContractError> {
    let frozen: bool = env
        .storage()
        .instance()
        .get(&DataKey::MetadataFrozen)
        .unwrap_or(false);
    if frozen {
        return Err(ContractError::MetadataFrozen);
    }
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    if *caller != owner {
        crate::access_control::require_metadata_updater(env, caller)?;
    } else {
        caller.require_auth();
    }
    env.storage()
        .instance()
        .set(&DataKey::TokenUri(token_id), &uri);
    events::emit_token_uri_updated(env, token_id, uri);
    Ok(())
}

/// Updates base URI. Admin only. Fails if metadata is frozen.
pub fn set_base_uri(env: &Env, caller: &Address, base_uri: String) -> Result<(), ContractError> {
    let frozen: bool = env
        .storage()
        .instance()
        .get(&DataKey::MetadataFrozen)
        .unwrap_or(false);
    if frozen {
        return Err(ContractError::MetadataFrozen);
    }
    crate::access_control::require_admin(env, caller)?;
    env.storage().instance().set(&DataKey::BaseUri, &base_uri);
    events::emit_base_uri_updated(env, base_uri);
    Ok(())
}

/// Permanently freezes metadata. Owner only. Irreversible.
pub fn freeze_metadata(env: &Env, caller: Address) -> Result<(), ContractError> {
    crate::access_control::require_owner(env)?;
    env.storage()
        .instance()
        .set(&DataKey::MetadataFrozen, &true);
    events::emit_metadata_frozen(env, caller);
    Ok(())
}

/// Sets edition number and total editions for a token (limited editions). Owner or metadata updater; fails if metadata frozen.
pub fn set_edition_info(
    env: &Env,
    token_id: u64,
    edition_number: Option<u32>,
    total_editions: Option<u32>,
    caller: &Address,
) -> Result<(), ContractError> {
    let frozen: bool = env
        .storage()
        .instance()
        .get(&DataKey::MetadataFrozen)
        .unwrap_or(false);
    if frozen {
        return Err(ContractError::MetadataFrozen);
    }
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    if *caller != owner {
        crate::access_control::require_metadata_updater(env, caller)?;
    } else {
        caller.require_auth();
    }
    if let Some(n) = edition_number {
        env.storage()
            .instance()
            .set(&DataKey::TokenEditionNumber(token_id), &n);
    } else {
        env.storage()
            .instance()
            .remove(&DataKey::TokenEditionNumber(token_id));
    }
    if let Some(n) = total_editions {
        env.storage()
            .instance()
            .set(&DataKey::TokenTotalEditions(token_id), &n);
    } else {
        env.storage()
            .instance()
            .remove(&DataKey::TokenTotalEditions(token_id));
    }
    Ok(())
}
