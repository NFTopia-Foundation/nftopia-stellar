use crate::access_control::require_admin;
use crate::error::ContractError;
use crate::storage::DataKey;
use crate::types::RoyaltyInfo;
use soroban_sdk::{Address, Env};

pub fn get_royalty_default(env: &Env) -> Option<RoyaltyInfo> {
    env.storage().instance().get(&DataKey::RoyaltyDefault)
}

pub fn set_royalty_default(
    env: &Env,
    recipient: &Address,
    percentage: u32,
) -> Result<(), ContractError> {
    require_admin(env)?;
    // Validate percentage is <= 10000 (100.00%)
    if percentage > 10000 {
        return Err(ContractError::NotPermitted);
    }

    let info = RoyaltyInfo {
        recipient: recipient.clone(),
        percentage,
    };
    env.storage()
        .instance()
        .set(&DataKey::RoyaltyDefault, &info);
    Ok(())
}

pub fn calculate_royalty(env: &Env, sale_price: i128) -> Option<(Address, i128)> {
    if let Some(info) = get_royalty_default(env) {
        if info.percentage == 0 {
            return None;
        }
        let royalty_amount = (sale_price * (info.percentage as i128)) / 10000;
        Some((info.recipient, royalty_amount))
    } else {
        None
    }
}
