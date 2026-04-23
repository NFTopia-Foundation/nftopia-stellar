use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::storage::{DataKey, MAX_ROYALTY_BPS};
use crate::types::RoyaltyInfo;
use soroban_sdk::{Address, Env};

pub fn set_default_royalty(
    env: &Env,
    caller: &Address,
    recipient: Address,
    percentage: u32,
) -> Result<(), ContractError> {
    access_control::require_admin_or_owner(env, caller);
    if percentage > MAX_ROYALTY_BPS {
        return Err(ContractError::InvalidRoyalty);
    }
    let info = RoyaltyInfo {
        recipient: recipient.clone(),
        percentage,
    };
    env.storage()
        .instance()
        .set(&DataKey::DefaultRoyalty, &info);
    events::emit_royalty_update(env, recipient, percentage);
    Ok(())
}

pub fn set_token_royalty(
    env: &Env,
    caller: &Address,
    token_id: u64,
    recipient: Address,
    percentage: u32,
) -> Result<(), ContractError> {
    access_control::require_admin_or_owner(env, caller);
    if percentage > MAX_ROYALTY_BPS {
        return Err(ContractError::InvalidRoyalty);
    }
    let info = RoyaltyInfo {
        recipient,
        percentage,
    };
    env.storage()
        .persistent()
        .set(&DataKey::TokenRoyalty(token_id), &info);
    Ok(())
}

/// EIP-2981 equivalent: returns (recipient, royalty_amount) for a given sale price.
pub fn get_royalty_info(
    env: &Env,
    token_id: u64,
    sale_price: i128,
) -> Result<(Address, i128), ContractError> {
    let info: RoyaltyInfo = env
        .storage()
        .persistent()
        .get(&DataKey::TokenRoyalty(token_id))
        .or_else(|| env.storage().instance().get(&DataKey::DefaultRoyalty))
        .ok_or(ContractError::NotFound)?;

    let royalty_amount = sale_price
        .checked_mul(info.percentage as i128)
        .and_then(|v| v.checked_div(MAX_ROYALTY_BPS as i128))
        .ok_or(ContractError::ArithmeticError)?;

    Ok((info.recipient, royalty_amount))
}
