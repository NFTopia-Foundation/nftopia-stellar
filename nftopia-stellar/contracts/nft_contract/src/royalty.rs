use soroban_sdk::{Address, Env};
use crate::storage::Storage;
use crate::access_control::AccessControl;
use crate::error::ContractError;
use crate::token::RoyaltyInfo;
use crate::events::Events;

pub struct Royalty;

impl Royalty {
    /// Get royalty information for a token
    /// Returns (recipient, royalty_amount) for the given sale price
    pub fn get_royalty_info(
        env: &Env,
        token_id: u64,
        sale_price: i128,
    ) -> Result<(Address, i128), ContractError> {
        let token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        let royalty_info = RoyaltyInfo {
            recipient: token.royalty_recipient.clone(),
            percentage: token.royalty_percentage,
        };

        if !royalty_info.validate() {
            return Err(ContractError::InvalidRoyaltyPercentage);
        }

        let royalty_amount = royalty_info.calculate_royalty(sale_price)?;

        Ok((token.royalty_recipient, royalty_amount))
    }

    /// Set default royalty for the collection (admin only)
    pub fn set_default_royalty(
        env: &Env,
        caller: &Address,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        AccessControl::require_admin(env, caller)?;

        let royalty_info = RoyaltyInfo::new(recipient.clone(), percentage);
        if !royalty_info.validate() {
            return Err(ContractError::InvalidRoyaltyPercentage);
        }

        let mut config = Storage::get_config(env)
            .ok_or(ContractError::ContractNotInitialized)?;

        config.royalty_default = royalty_info.clone();
        Storage::set_config(env, &config);

        Events::emit_royalty_update(env, None, recipient, percentage);

        Ok(())
    }

    /// Set royalty for a specific token (owner or admin only)
    pub fn set_token_royalty(
        env: &Env,
        caller: &Address,
        token_id: u64,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        let token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        // Check permissions
        if token.owner != *caller && !Storage::is_admin(env, caller) {
            return Err(ContractError::Unauthorized);
        }

        let royalty_info = RoyaltyInfo::new(recipient.clone(), percentage);
        if !royalty_info.validate() {
            return Err(ContractError::InvalidRoyaltyPercentage);
        }

        // Update token royalty
        let mut updated_token = token.clone();
        updated_token.royalty_percentage = percentage;
        updated_token.royalty_recipient = recipient.clone();
        Storage::set_token(env, token_id, &updated_token);

        Events::emit_royalty_update(env, Some(token_id), recipient, percentage);

        Ok(())
    }

    /// Get default royalty info
    pub fn get_default_royalty(env: &Env) -> Result<RoyaltyInfo, ContractError> {
        let config = Storage::get_config(env)
            .ok_or(ContractError::ContractNotInitialized)?;
        Ok(config.royalty_default)
    }
}
