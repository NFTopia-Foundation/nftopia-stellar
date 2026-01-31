use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::reentrancy;
use crate::storage::DataKey;
use crate::types::{RoyaltyInfo, TokenAttribute};
use crate::utils::validate_royalty_bps;
use soroban_sdk::{Address, Env, Vec};

/// Mints a new token. Requires minter role; if whitelist-only mode, caller must be whitelisted.
pub fn mint(
    env: &Env,
    caller: Address,
    to: Address,
    metadata_uri: soroban_sdk::String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
) -> Result<u64, ContractError> {
    access_control::require_minter(env, &caller)?;
    access_control::require_not_paused(env)?;
    let whitelist_only: bool = env
        .storage()
        .instance()
        .get(&DataKey::WhitelistOnlyMint)
        .unwrap_or(false);
    if whitelist_only {
        access_control::require_whitelisted(env, &caller)?;
    }
    reentrancy::acquire(env)?;
    let result = mint_internal(env, caller, to, metadata_uri, attributes, royalty_override);
    reentrancy::release(env);
    result
}

/// Internal mint without auth/role checks. Caller must have already verified minter, paused, whitelist.
pub(crate) fn mint_internal(
    env: &Env,
    caller: Address,
    to: Address,
    metadata_uri: soroban_sdk::String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
) -> Result<u64, ContractError> {
    let next_id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(0);
    let max_supply: Option<u64> = env.storage().instance().get(&DataKey::MaxSupply);
    if let Some(max) = max_supply {
        let total: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        if total >= max {
            return Err(ContractError::SupplyLimitExceeded);
        }
    }

    env.storage().instance().set(&DataKey::Owner(next_id), &to);
    env.storage()
        .instance()
        .set(&DataKey::TokenUri(next_id), &metadata_uri);
    env.storage()
        .instance()
        .set(&DataKey::TokenCreatedAt(next_id), &env.ledger().timestamp());
    env.storage()
        .instance()
        .set(&DataKey::TokenCreator(next_id), &caller);
    env.storage()
        .instance()
        .set(&DataKey::TokenAttributes(next_id), &attributes);

    let (_royalty_bps, _royalty_recipient) = match royalty_override {
        Some(r) => {
            validate_royalty_bps(r.percentage)?;
            env.storage()
                .instance()
                .set(&DataKey::TokenRoyaltyBps(next_id), &r.percentage);
            env.storage()
                .instance()
                .set(&DataKey::TokenRoyaltyRecipient(next_id), &r.recipient);
            (r.percentage, r.recipient)
        }
        None => {
            let def: RoyaltyInfo = env
                .storage()
                .instance()
                .get(&DataKey::DefaultRoyalty)
                .ok_or(ContractError::NotFound)?;
            (def.percentage, def.recipient)
        }
    };

    let balance: u64 = env
        .storage()
        .instance()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::Balance(to.clone()), &(balance + 1));

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::TotalSupply, &(total + 1));
    env.storage()
        .instance()
        .set(&DataKey::NextTokenId, &(next_id + 1));

    events::emit_mint(env, to, next_id, caller);
    Ok(next_id)
}

/// Burns a token. Requires owner or burner role. `confirm` must be true for safety.
pub fn burn(env: &Env, caller: Address, token_id: u64, confirm: bool) -> Result<(), ContractError> {
    if !confirm {
        return Err(ContractError::BurnNotConfirmed);
    }
    reentrancy::acquire(env)?;
    let result = burn_internal(env, caller, token_id);
    reentrancy::release(env);
    result
}

fn burn_internal(env: &Env, caller: Address, token_id: u64) -> Result<(), ContractError> {
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;

    if caller == owner {
        caller.require_auth();
    } else {
        access_control::require_burner(env, &caller)?;
    }

    env.storage().instance().remove(&DataKey::Owner(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::Approved(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenUri(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenCreatedAt(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenCreator(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenAttributes(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenRoyaltyBps(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenRoyaltyRecipient(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenEditionNumber(token_id));
    env.storage()
        .instance()
        .remove(&DataKey::TokenTotalEditions(token_id));

    let balance: u64 = env
        .storage()
        .instance()
        .get(&DataKey::Balance(owner.clone()))
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::Balance(owner.clone()), &balance.saturating_sub(1));

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
