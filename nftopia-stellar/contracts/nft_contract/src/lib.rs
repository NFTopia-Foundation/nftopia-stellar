#![no_std]

mod access_control;
mod error;
mod events;
mod interface;
mod metadata;
mod reentrancy;
mod royalty;
mod storage;
mod token;
mod transfer;
mod types;
mod utils;

pub use error::ContractError;
pub use types::{CollectionConfig, RoyaltyInfo, TokenAttribute, TokenMetadata};

use soroban_sdk::Address;
use soroban_sdk::Bytes;
use soroban_sdk::Env;
use soroban_sdk::String;
use soroban_sdk::Vec;
use soroban_sdk::contract;
use soroban_sdk::contractimpl;

use crate::error::ContractError as Err;
use crate::storage::DataKey;
use crate::utils::validate_royalty_bps;

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    /// Initializes the NFT contract.
    pub fn initialize(env: Env, owner: Address, config: CollectionConfig) -> Result<(), Err> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Err::AlreadyInitialized);
        }
        validate_royalty_bps(config.royalty_default.percentage)?;

        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::OwnerRole, &owner);
        env.storage()
            .instance()
            .set(&DataKey::CollectionConfig, &config);
        env.storage()
            .instance()
            .set(&DataKey::DefaultRoyalty, &config.royalty_default);
        env.storage()
            .instance()
            .set(&DataKey::BaseUri, &config.base_uri.clone());
        env.storage()
            .instance()
            .set(&DataKey::MetadataFrozen, &config.metadata_is_frozen);
        env.storage().instance().set(&DataKey::NextTokenId, &0u64);
        env.storage().instance().set(&DataKey::TotalSupply, &0u64);
        env.storage().instance().set(&DataKey::Paused, &false);
        if let Some(max) = config.max_supply {
            env.storage().instance().set(&DataKey::MaxSupply, &max);
        }
        Ok(())
    }

    // --- Token Management ---
    pub fn mint(
        env: Env,
        caller: Address,
        to: Address,
        metadata_uri: String,
        attributes: Vec<crate::types::TokenAttribute>,
        royalty_override: Option<RoyaltyInfo>,
    ) -> Result<u64, Err> {
        token::mint(&env, caller, to, metadata_uri, attributes, royalty_override)
    }

    pub fn burn(env: Env, caller: Address, token_id: u64, confirm: bool) -> Result<(), Err> {
        token::burn(&env, caller, token_id, confirm)
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) -> Result<(), Err> {
        transfer::transfer(&env, from, to, token_id)
    }

    pub fn safe_transfer_from(
        env: Env,
        from: Address,
        to: Address,
        token_id: u64,
        data: Option<Bytes>,
    ) -> Result<(), Err> {
        transfer::safe_transfer_from(&env, from, to, token_id, data)
    }

    pub fn batch_transfer(
        env: Env,
        from: Address,
        to: Address,
        token_ids: Vec<u64>,
    ) -> Result<(), Err> {
        transfer::batch_transfer(&env, from, to, token_ids)
    }

    // --- Ownership & Approvals ---
    pub fn owner_of(env: Env, token_id: u64) -> Result<Address, Err> {
        env.storage()
            .instance()
            .get(&DataKey::Owner(token_id))
            .ok_or(Err::TokenNotFound)
    }

    pub fn balance_of(env: Env, owner: Address) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0)
    }

    pub fn approve(env: Env, caller: Address, approved: Address, token_id: u64) -> Result<(), Err> {
        caller.require_auth();
        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner(token_id))
            .ok_or(Err::TokenNotFound)?;
        if owner != caller {
            let is_operator: bool = env
                .storage()
                .instance()
                .get(&DataKey::OperatorApproval(owner.clone(), caller))
                .unwrap_or(false);
            if !is_operator {
                return Err(Err::NotAuthorized);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::Approved(token_id), &approved);
        crate::events::emit_approval(&env, owner, approved, token_id);
        Ok(())
    }

    pub fn set_approval_for_all(
        env: Env,
        caller: Address,
        operator: Address,
        approved: bool,
    ) -> Result<(), Err> {
        caller.require_auth();
        env.storage().instance().set(
            &DataKey::OperatorApproval(caller.clone(), operator.clone()),
            &approved,
        );
        crate::events::emit_approval_for_all(&env, caller, operator, approved);
        Ok(())
    }

    pub fn get_approved(env: Env, token_id: u64) -> Result<Option<Address>, Err> {
        let _ = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::Owner(token_id))
            .ok_or(Err::TokenNotFound)?;
        let approved: Option<Address> = env.storage().instance().get(&DataKey::Approved(token_id));
        Ok(approved)
    }

    pub fn is_approved_for_all(env: Env, owner: Address, operator: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::OperatorApproval(owner, operator))
            .unwrap_or(false)
    }

    // --- Metadata ---
    pub fn token_uri(env: Env, token_id: u64) -> Result<String, Err> {
        crate::metadata::token_uri(&env, token_id)
    }

    pub fn token_metadata(env: Env, token_id: u64) -> Result<TokenMetadata, Err> {
        crate::metadata::token_metadata(&env, token_id)
    }

    pub fn set_token_uri(env: Env, caller: Address, token_id: u64, uri: String) -> Result<(), Err> {
        crate::metadata::set_token_uri(&env, token_id, uri, &caller)
    }

    pub fn set_base_uri(env: Env, caller: Address, base_uri: String) -> Result<(), Err> {
        crate::metadata::set_base_uri(&env, &caller, base_uri)
    }

    pub fn freeze_metadata(env: Env, caller: Address) -> Result<(), Err> {
        crate::metadata::freeze_metadata(&env, caller)
    }

    pub fn set_edition_info(
        env: Env,
        caller: Address,
        token_id: u64,
        edition_number: Option<u32>,
        total_editions: Option<u32>,
    ) -> Result<(), Err> {
        crate::metadata::set_edition_info(&env, token_id, edition_number, total_editions, &caller)
    }

    // --- Royalty ---
    pub fn get_royalty_info(
        env: Env,
        token_id: u64,
        sale_price: i128,
    ) -> Result<(Address, i128), Err> {
        crate::royalty::get_royalty_info(&env, token_id, sale_price)
    }

    pub fn set_default_royalty(
        env: Env,
        caller: Address,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), Err> {
        crate::royalty::set_default_royalty(&env, caller, recipient, percentage)
    }

    pub fn set_royalty_info(
        env: Env,
        caller: Address,
        token_id: u64,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), Err> {
        crate::royalty::set_royalty_info(&env, caller, token_id, recipient, percentage)
    }

    // --- Batch ---
    pub fn batch_mint(
        env: Env,
        caller: Address,
        recipients: Vec<Address>,
        metadata_uris: Vec<String>,
        attributes: Vec<Vec<crate::types::TokenAttribute>>,
    ) -> Result<Vec<u64>, Err> {
        if recipients.len() != metadata_uris.len() || recipients.len() != attributes.len() {
            return Err(Err::BatchLengthMismatch);
        }
        access_control::require_minter(&env, &caller)?;
        access_control::require_not_paused(&env)?;
        let whitelist_only: bool = env
            .storage()
            .instance()
            .get(&DataKey::WhitelistOnlyMint)
            .unwrap_or(false);
        if whitelist_only {
            access_control::require_whitelisted(&env, &caller)?;
        }
        reentrancy::acquire(&env)?;
        let result = (|| {
            let mut ids = Vec::new(&env);
            for i in 0..recipients.len() {
                let to = recipients.get(i).unwrap();
                let uri = metadata_uris.get(i).unwrap();
                let attrs = attributes.get(i).unwrap();
                let id = token::mint_internal(&env, caller.clone(), to, uri, attrs, None)?;
                ids.push_back(id);
            }
            Ok(ids)
        })();
        reentrancy::release(&env);
        result
    }

    // --- Collection Info ---
    pub fn name(env: Env) -> Result<String, Err> {
        let config: CollectionConfig = env
            .storage()
            .instance()
            .get(&DataKey::CollectionConfig)
            .ok_or(Err::NotFound)?;
        Ok(config.name)
    }

    pub fn symbol(env: Env) -> Result<String, Err> {
        let config: CollectionConfig = env
            .storage()
            .instance()
            .get(&DataKey::CollectionConfig)
            .ok_or(Err::NotFound)?;
        Ok(config.symbol)
    }

    pub fn total_supply(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    // --- Access Control ---
    pub fn set_pause(env: Env, caller: Address, paused: bool) -> Result<(), Err> {
        crate::access_control::require_admin(&env, &caller)?;
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    pub fn set_admin(env: Env, admin: Address, granted: bool) -> Result<(), Err> {
        crate::access_control::require_owner(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::Admin(admin), &granted);
        Ok(())
    }

    pub fn set_minter(
        env: Env,
        caller: Address,
        minter: Address,
        granted: bool,
    ) -> Result<(), Err> {
        crate::access_control::require_admin(&env, &caller)?;
        env.storage()
            .instance()
            .set(&DataKey::Minter(minter), &granted);
        Ok(())
    }

    pub fn set_burner(
        env: Env,
        caller: Address,
        burner: Address,
        granted: bool,
    ) -> Result<(), Err> {
        crate::access_control::require_admin(&env, &caller)?;
        env.storage()
            .instance()
            .set(&DataKey::Burner(burner), &granted);
        Ok(())
    }

    pub fn set_metadata_updater(
        env: Env,
        caller: Address,
        updater: Address,
        granted: bool,
    ) -> Result<(), Err> {
        crate::access_control::require_admin(&env, &caller)?;
        env.storage()
            .instance()
            .set(&DataKey::MetadataUpdater(updater), &granted);
        Ok(())
    }

    pub fn set_whitelist(
        env: Env,
        caller: Address,
        address: Address,
        allowed: bool,
    ) -> Result<(), Err> {
        crate::access_control::require_admin(&env, &caller)?;
        env.storage()
            .instance()
            .set(&DataKey::Whitelist(address), &allowed);
        Ok(())
    }

    pub fn set_whitelist_only_mint(env: Env, caller: Address, enabled: bool) -> Result<(), Err> {
        crate::access_control::require_admin(&env, &caller)?;
        env.storage()
            .instance()
            .set(&DataKey::WhitelistOnlyMint, &enabled);
        Ok(())
    }

    // --- Interface detection (ERC-165 equivalent) ---
    pub fn supports_interface(env: Env, interface_id: u32) -> bool {
        let _ = env;
        matches!(
            interface_id,
            crate::interface::INTERFACE_ID_NFT
                | crate::interface::INTERFACE_ID_ROYALTY
                | crate::interface::INTERFACE_ID_METADATA
        )
    }
}

#[cfg(test)]
mod test;
