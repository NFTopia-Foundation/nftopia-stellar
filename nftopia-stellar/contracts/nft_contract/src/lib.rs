#![no_std]

pub mod access_control;
pub mod error;
pub mod events;
pub mod interface;
pub mod metadata;
pub mod royalty;
pub mod storage;
pub mod token;
pub mod transfer;
pub mod types;

use crate::access_control as ac;
use crate::error::ContractError;
use crate::storage::DataKey;
use crate::types::{CollectionConfig, RoyaltyInfo, TokenAttribute, TokenData};
use soroban_sdk::{Address, Env, String, Vec, contract, contractimpl, panic_with_error};

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------

    pub fn initialize(
        env: Env,
        admin: Address,
        config: CollectionConfig,
        default_royalty: Option<RoyaltyInfo>,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CollectionConfig, &config);
        env.storage().instance().set(&DataKey::TotalSupply, &0u64);
        env.storage().instance().set(&DataKey::NextTokenId, &1u64);
        env.storage().instance().set(&DataKey::IsPaused, &false);
        env.storage()
            .instance()
            .set(&DataKey::MetadataFrozen, &false);

        ac::init_owner(&env, &admin);

        if let Some(royalty) = default_royalty {
            if royalty.percentage > crate::storage::MAX_ROYALTY_BPS {
                return Err(ContractError::InvalidRoyalty);
            }
            env.storage()
                .instance()
                .set(&DataKey::DefaultRoyalty, &royalty);
        }

        Ok(())
    }

    // -------------------------------------------------------------------------
    // Token management
    // -------------------------------------------------------------------------

    pub fn mint(
        env: Env,
        caller: Address,
        to: Address,
        metadata_uri: String,
        attributes: Vec<TokenAttribute>,
        royalty_override: Option<RoyaltyInfo>,
    ) -> Result<u64, ContractError> {
        caller.require_auth();
        token::mint(
            &env,
            &caller,
            to,
            metadata_uri,
            attributes,
            royalty_override,
        )
    }

    pub fn batch_mint(
        env: Env,
        caller: Address,
        recipients: Vec<Address>,
        metadata_uris: Vec<String>,
        attributes: Vec<Vec<TokenAttribute>>,
    ) -> Result<Vec<u64>, ContractError> {
        caller.require_auth();
        token::batch_mint(&env, &caller, recipients, metadata_uris, attributes)
    }

    pub fn burn(env: Env, caller: Address, token_id: u64) -> Result<(), ContractError> {
        caller.require_auth();
        token::burn(&env, &caller, token_id)
    }

    pub fn transfer(
        env: Env,
        caller: Address,
        from: Address,
        to: Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        token::transfer(&env, &caller, from, to, token_id)
    }

    pub fn safe_transfer_from(
        env: Env,
        caller: Address,
        from: Address,
        to: Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        token::safe_transfer_from(&env, &caller, from, to, token_id)
    }

    pub fn batch_transfer(
        env: Env,
        caller: Address,
        from: Address,
        to: Address,
        token_ids: Vec<u64>,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        token::batch_transfer(&env, &caller, from, to, token_ids)
    }

    // -------------------------------------------------------------------------
    // Ownership & Approvals
    // -------------------------------------------------------------------------

    pub fn owner_of(env: Env, token_id: u64) -> Result<Address, ContractError> {
        token::owner_of(&env, token_id)
    }

    pub fn balance_of(env: Env, owner: Address) -> u64 {
        token::balance_of(&env, &owner)
    }

    pub fn total_supply(env: Env) -> u64 {
        token::total_supply(&env)
    }

    pub fn approve(
        env: Env,
        owner: Address,
        approved: Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        owner.require_auth();
        transfer::approve(&env, &owner, &approved, token_id)
    }

    pub fn set_approval_for_all(env: Env, owner: Address, operator: Address, approved: bool) {
        owner.require_auth();
        transfer::set_approval_for_all(&env, &owner, &operator, approved);
    }

    pub fn get_approved(env: Env, token_id: u64) -> Option<Address> {
        transfer::get_approved(&env, token_id)
    }

    pub fn is_approved_for_all(env: Env, owner: Address, operator: Address) -> bool {
        transfer::is_approved_for_all(&env, &owner, &operator)
    }

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    pub fn token_uri(env: Env, token_id: u64) -> Result<String, ContractError> {
        metadata::token_uri(&env, token_id)
    }

    pub fn token_metadata(env: Env, token_id: u64) -> Result<TokenData, ContractError> {
        metadata::token_metadata(&env, token_id)
    }

    pub fn set_token_uri(
        env: Env,
        caller: Address,
        token_id: u64,
        uri: String,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        metadata::set_token_uri(&env, &caller, token_id, uri)
    }

    pub fn set_base_uri(env: Env, caller: Address, base_uri: String) -> Result<(), ContractError> {
        caller.require_auth();
        metadata::set_base_uri(&env, &caller, base_uri)
    }

    pub fn freeze_metadata(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        metadata::freeze_metadata(&env, &caller)
    }

    pub fn is_metadata_frozen(env: Env) -> bool {
        metadata::is_metadata_frozen(&env)
    }

    // -------------------------------------------------------------------------
    // Royalty
    // -------------------------------------------------------------------------

    pub fn set_default_royalty(
        env: Env,
        caller: Address,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        royalty::set_default_royalty(&env, &caller, recipient, percentage)
    }

    pub fn set_token_royalty(
        env: Env,
        caller: Address,
        token_id: u64,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        royalty::set_token_royalty(&env, &caller, token_id, recipient, percentage)
    }

    pub fn get_royalty_info(
        env: Env,
        token_id: u64,
        sale_price: i128,
    ) -> Result<(Address, i128), ContractError> {
        royalty::get_royalty_info(&env, token_id, sale_price)
    }

    // -------------------------------------------------------------------------
    // Access control
    // -------------------------------------------------------------------------

    pub fn grant_role(env: Env, caller: Address, target: Address, role: u32) {
        caller.require_auth();
        ac::grant_role(&env, &caller, &target, role);
    }

    pub fn revoke_role(env: Env, caller: Address, target: Address, role: u32) {
        caller.require_auth();
        ac::revoke_role(&env, &caller, &target, role);
    }

    pub fn has_role(env: Env, address: Address, role: u32) -> bool {
        ac::has_role(&env, &address, role)
    }

    // -------------------------------------------------------------------------
    // Admin controls
    // -------------------------------------------------------------------------

    pub fn set_pause(env: Env, caller: Address, paused: bool) {
        caller.require_auth();
        ac::require_admin_or_owner(&env, &caller);
        env.storage().instance().set(&DataKey::IsPaused, &paused);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<_, bool>(&DataKey::IsPaused)
            .unwrap_or(false)
    }

    // -------------------------------------------------------------------------
    // Interface detection (ERC-165 equivalent)
    // -------------------------------------------------------------------------

    pub fn supports_interface(env: Env, interface_id: u32) -> bool {
        let _ = env;
        interface::supports_interface(interface_id)
    }
}

#[cfg(test)]
mod test;
