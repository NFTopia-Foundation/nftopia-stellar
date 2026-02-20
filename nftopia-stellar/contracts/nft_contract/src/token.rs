use crate::access_control::require_role;
use crate::error::ContractError;
use crate::events::{emit_burn, emit_mint};
use crate::royalty::get_royalty_default;
use crate::storage::DataKey;
use crate::types::{Role, RoyaltyInfo, TokenAttribute, TokenData};
use soroban_sdk::{Address, Env, String, Vec};

pub fn get_token(env: &Env, token_id: u64) -> Result<TokenData, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Token(token_id))
        .ok_or(ContractError::TokenNotFound)
}

pub fn increment_supply(env: &Env) -> u64 {
    let mut current: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    current += 1;
    env.storage()
        .instance()
        .set(&DataKey::TotalSupply, &current);
    current
}

pub fn mint_token(
    env: &Env,
    to: &Address,
    metadata_uri: String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
    sender: &Address,
) -> Result<u64, ContractError> {
    require_role(env, Role::Minter, sender)?;

    let token_id = increment_supply(env);

    let royalty = royalty_override.unwrap_or_else(|| {
        get_royalty_default(env).unwrap_or(RoyaltyInfo {
            recipient: to.clone(),
            percentage: 0,
        })
    });

    let token = TokenData {
        id: token_id,
        owner: to.clone(),
        approved: None,
        metadata_uri,
        created_at: env.ledger().timestamp(),
        creator: sender.clone(),
        royalty_percentage: royalty.percentage,
        royalty_recipient: royalty.recipient,
        attributes,
        edition_number: None,
        total_editions: None,
    };

    env.storage()
        .persistent()
        .set(&DataKey::Token(token_id), &token);

    // Update balance
    let mut balance: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    balance += 1;
    env.storage()
        .persistent()
        .set(&DataKey::Balance(to.clone()), &balance);

    emit_mint(env, to, token_id);

    Ok(token_id)
}

pub fn burn_token(env: &Env, token_id: u64, sender: &Address) -> Result<(), ContractError> {
    let token = get_token(env, token_id)?;
    if token.owner != *sender {
        require_role(env, Role::Burner, sender)?;
    } else {
        sender.require_auth();
    }

    env.storage().persistent().remove(&DataKey::Token(token_id));

    // Update balance
    let mut balance: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(token.owner.clone()))
        .unwrap_or(0);
    if balance > 0 {
        balance -= 1;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(token.owner.clone()), &balance);
    }

    emit_burn(env, token_id);

    Ok(())
}
