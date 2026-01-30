use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use crate::types::RoyaltyInfo;
use crate::utils::{calculate_royalty, validate_royalty_bps};
use soroban_sdk::Address;
use soroban_sdk::Env;

/// Returns (recipient, royalty_amount) for a given token and sale price (EIP-2981 equivalent).
pub fn get_royalty_info(
    env: &Env,
    token_id: u64,
    sale_price: i128,
) -> Result<(Address, i128), ContractError> {
    let _owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    let default_royalty: RoyaltyInfo = env
        .storage()
        .instance()
        .get(&DataKey::DefaultRoyalty)
        .ok_or(ContractError::NotFound)?;
    let royalty_bps: u32 = env
        .storage()
        .instance()
        .get(&DataKey::TokenRoyaltyBps(token_id))
        .unwrap_or(default_royalty.percentage);
    let recipient: Address = env
        .storage()
        .instance()
        .get(&DataKey::TokenRoyaltyRecipient(token_id))
        .unwrap_or(default_royalty.recipient);
    let (royalty_amount, _) = calculate_royalty(sale_price, royalty_bps);
    Ok((recipient, royalty_amount))
}

/// Sets default royalty for the collection. Admin only.
pub fn set_default_royalty(
    env: &Env,
    caller: Address,
    recipient: Address,
    percentage: u32,
) -> Result<(), ContractError> {
    validate_royalty_bps(percentage)?;
    crate::access_control::require_admin(env, &caller)?;
    let info = RoyaltyInfo {
        recipient,
        percentage,
    };
    env.storage()
        .instance()
        .set(&DataKey::DefaultRoyalty, &info);
    Ok(())
}

/// Sets token-level royalty override. Owner or admin only.
pub fn set_royalty_info(
    env: &Env,
    caller: Address,
    token_id: u64,
    recipient: Address,
    percentage: u32,
) -> Result<(), ContractError> {
    validate_royalty_bps(percentage)?;
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    if caller != owner {
        crate::access_control::require_admin(env, &caller)?;
    } else {
        caller.require_auth();
    }
    env.storage()
        .instance()
        .set(&DataKey::TokenRoyaltyBps(token_id), &percentage);
    env.storage()
        .instance()
        .set(&DataKey::TokenRoyaltyRecipient(token_id), &recipient);
    events::emit_royalty_updated(env, token_id, recipient, percentage);
    Ok(())
}
