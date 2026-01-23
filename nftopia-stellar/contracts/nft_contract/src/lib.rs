#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String as SorobanString, Vec};
use crate::error::ContractError;
use crate::storage::{Storage, CollectionConfig};
use crate::access_control::AccessControl;
use crate::token::{TokenData, RoyaltyInfo, TokenAttribute};
use crate::transfer::Transfer;
use crate::metadata::Metadata;
use crate::royalty::Royalty;
use crate::events::Events;
use crate::utils::Utils;

mod error;
mod token;
mod storage;
mod access_control;
mod events;
mod metadata;
mod royalty;
mod transfer;
mod utils;

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    /// Initialize the NFT contract
    /// Must be called once before any other operations
    pub fn initialize(
        env: Env,
        owner: Address,
        name: SorobanString,
        symbol: SorobanString,
        base_uri: SorobanString,
        max_supply: Option<u64>,
        mint_price: Option<i128>,
        default_royalty: RoyaltyInfo,
    ) -> Result<(), ContractError> {
        // Check if already initialized
        if Storage::is_initialized(&env) {
            return Err(ContractError::AlreadyExists);
        }

        // Validate inputs
        if !Utils::is_valid_address(&owner) {
            return Err(ContractError::InvalidInput);
        }

        if !Utils::is_valid_string(&name) || !Utils::is_valid_string(&symbol) {
            return Err(ContractError::InvalidInput);
        }

        if !default_royalty.validate() {
            return Err(ContractError::InvalidRoyaltyPercentage);
        }

        // Set owner
        Storage::set_owner(&env, &owner);

        // Create and set config
        let config = CollectionConfig::new(
            name,
            symbol,
            base_uri,
            max_supply,
            mint_price,
            default_royalty,
        );
        Storage::set_config(&env, &config);

        // Mark as initialized
        Storage::set_initialized(&env);

        Ok(())
    }

    // ============ Token Management ============

    /// Mint a new NFT
    pub fn mint(
        env: Env,
        to: Address,
        metadata_uri: SorobanString,
        attributes: Vec<TokenAttribute>,
        royalty_override: Option<RoyaltyInfo>,
        edition_info: Option<(u32, u32)>, // (edition_number, total_editions)
    ) -> Result<u64, ContractError> {
        // TODO: Update for Soroban SDK v23
        let caller = crate::utils::Utils::get_invoker(&env);

        // Check permissions
        AccessControl::require_minter(&env, &caller)?;
        AccessControl::require_not_paused(&env)?;

        // Validate inputs
        if !Utils::is_valid_address(&to) {
            return Err(ContractError::InvalidInput);
        }

        if !Utils::is_valid_string(&metadata_uri) {
            return Err(ContractError::InvalidMetadataUri);
        }

        // Check max supply
        let config = Storage::get_config(&env)
            .ok_or(ContractError::ContractNotInitialized)?;

        if let Some(max) = config.max_supply {
            let current_supply = Storage::get_total_supply(&env);
            if current_supply >= max {
                return Err(ContractError::MaxSupplyExceeded);
            }
        }

        // Get or use default royalty
        let royalty_info = match royalty_override {
            Some(royalty) => {
                if !royalty.validate() {
                    return Err(ContractError::InvalidRoyaltyPercentage);
                }
                royalty
            }
            None => config.royalty_default.clone(),
        };

        // Generate token ID
        let token_id = Storage::increment_total_supply(&env);

        // Create token data
        let mut token = TokenData::new(
            token_id,
            to.clone(),
            metadata_uri.clone(),
            caller.clone(),
            royalty_info,
            attributes,
            edition_info,
        );
        token.created_at = Utils::current_timestamp(&env);

        // Store token
        Storage::set_token(&env, token_id, &token);

        // Update balance
        Storage::increment_balance(&env, &to);

        // Emit event
        Events::emit_mint(&env, to, token_id, metadata_uri, caller);

        Ok(token_id)
    }

    /// Batch mint multiple NFTs
    pub fn batch_mint(
        env: Env,
        recipients: Vec<Address>,
        metadata_uris: Vec<SorobanString>,
        attributes_list: Vec<Vec<TokenAttribute>>,
        royalty_overrides: Option<Vec<RoyaltyInfo>>,
    ) -> Result<Vec<u64>, ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);

        // Check permissions
        AccessControl::require_minter(&env, &caller)?;
        AccessControl::require_not_paused(&env)?;

        // Validate inputs
        let count = recipients.len();
        if count == 0 || count != metadata_uris.len() || count != attributes_list.len() {
            return Err(ContractError::InvalidInput);
        }

        if let Some(ref overrides) = royalty_overrides {
            if overrides.len() != count {
                return Err(ContractError::InvalidInput);
            }
        }

        let mut token_ids = Vec::new(&env);

        for i in 0..count {
            let to = recipients.get(i).unwrap();
            let metadata_uri = metadata_uris.get(i).unwrap();
            let attributes = attributes_list.get(i).unwrap();
            let royalty_override = royalty_overrides
                .as_ref()
                .and_then(|o| o.get(i));

            let token_id = Self::mint(
                env.clone(),
                to.clone(),
                metadata_uri.clone(),
                attributes.clone(),
                royalty_override,
                None, // No edition info for batch mint
            )?;

            token_ids.push_back(token_id);
        }

        Ok(token_ids)
    }

    /// Burn (destroy) an NFT
    pub fn burn(
        env: Env,
        token_id: u64,
        confirm: bool,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);

        if !confirm {
            return Err(ContractError::InvalidInput);
        }

        // Get token
        let token = Storage::get_token(&env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        // Check permissions
        if token.owner != caller {
            AccessControl::require_burner(&env, &caller)?;
        }

        // Remove token
        Storage::remove_token(&env, token_id);

        // Update balance
        Storage::decrement_balance(&env, &token.owner);

        // Update total supply
        Storage::decrement_total_supply(&env);

        // Remove approval if exists
        Storage::remove_approval(&env, token_id);

        // Emit event
        Events::emit_burn(&env, token.owner, token_id);

        Ok(())
    }

    // ============ Ownership & Approvals ============

    /// Get owner of a token
    pub fn owner_of(env: Env, token_id: u64) -> Result<Address, ContractError> {
        let token = Storage::get_token(&env, token_id)
            .ok_or(ContractError::TokenNotFound)?;
        Ok(token.owner)
    }

    /// Get balance (token count) for an address
    pub fn balance_of(env: Env, owner: Address) -> u64 {
        Storage::get_balance(&env, &owner)
    }

    /// Approve an address to transfer a specific token
    pub fn approve(
        env: Env,
        approved: Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Transfer::approve(&env, &caller, &approved, token_id)
    }

    /// Set approval for all tokens
    pub fn set_approval_for_all(
        env: Env,
        operator: Address,
        approved: bool,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Transfer::set_approval_for_all(&env, &caller, &operator, approved)
    }

    /// Get approved address for a token
    pub fn get_approved(env: Env, token_id: u64) -> Result<Option<Address>, ContractError> {
        Transfer::get_approved(&env, token_id)
    }

    /// Check if operator is approved for all tokens
    pub fn is_approved_for_all(
        env: Env,
        owner: Address,
        operator: Address,
    ) -> bool {
        Transfer::is_approved_for_all(&env, &owner, &operator)
    }

    // ============ Transfers ============

    /// Transfer token from one address to another
    pub fn transfer_from(
        env: Env,
        from: Address,
        to: Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Transfer::transfer_from(&env, &caller, &from, &to, token_id)
    }

    /// Safe transfer with receiver contract validation
    pub fn safe_transfer_from(
        env: Env,
        from: Address,
        to: Address,
        token_id: u64,
        data: Option<Bytes>,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Transfer::safe_transfer_from(&env, &caller, &from, &to, token_id, data)
    }

    /// Batch transfer multiple tokens
    pub fn batch_transfer(
        env: Env,
        from: Address,
        to: Address,
        token_ids: Vec<u64>,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Transfer::batch_transfer(&env, &caller, &from, &to, token_ids)
    }

    // ============ Metadata ============

    /// Get token URI
    pub fn token_uri(env: Env, token_id: u64) -> Result<SorobanString, ContractError> {
        Metadata::get_token_uri(&env, token_id)
    }

    /// Get token metadata
    pub fn token_metadata(env: Env, token_id: u64) -> Result<TokenData, ContractError> {
        Metadata::get_token_metadata(&env, token_id)
    }

    /// Set token URI
    pub fn set_token_uri(
        env: Env,
        token_id: u64,
        metadata_uri: SorobanString,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Metadata::set_token_uri(&env, &caller, token_id, metadata_uri)
    }

    /// Set base URI (admin only)
    pub fn set_base_uri(
        env: Env,
        base_uri: SorobanString,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Metadata::set_base_uri(&env, &caller, base_uri)
    }

    /// Freeze metadata permanently (admin only)
    pub fn freeze_metadata(env: Env) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Metadata::freeze_metadata(&env, &caller)
    }

    // ============ Royalties ============

    /// Get royalty information for a token
    pub fn get_royalty_info(
        env: Env,
        token_id: u64,
        sale_price: i128,
    ) -> Result<(Address, i128), ContractError> {
        Royalty::get_royalty_info(&env, token_id, sale_price)
    }

    /// Set default royalty (admin only)
    pub fn set_default_royalty(
        env: Env,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Royalty::set_default_royalty(&env, &caller, recipient, percentage)
    }

    /// Set token-specific royalty
    pub fn set_token_royalty(
        env: Env,
        token_id: u64,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        Royalty::set_token_royalty(&env, &caller, token_id, recipient, percentage)
    }

    // ============ Collection Info ============

    /// Get collection name
    pub fn name(env: Env) -> Result<SorobanString, ContractError> {
        let config = Storage::get_config(&env)
            .ok_or(ContractError::ContractNotInitialized)?;
        Ok(config.name)
    }

    /// Get collection symbol
    pub fn symbol(env: Env) -> Result<SorobanString, ContractError> {
        let config = Storage::get_config(&env)
            .ok_or(ContractError::ContractNotInitialized)?;
        Ok(config.symbol)
    }

    /// Get total supply
    pub fn total_supply(env: Env) -> u64 {
        Storage::get_total_supply(&env)
    }

    /// Get max supply
    pub fn max_supply(env: Env) -> Result<Option<u64>, ContractError> {
        let config = Storage::get_config(&env)
            .ok_or(ContractError::ContractNotInitialized)?;
        Ok(config.max_supply)
    }

    // ============ Access Control ============

    /// Get contract owner
    pub fn owner(env: Env) -> Result<Address, ContractError> {
        Storage::get_owner(&env).ok_or(ContractError::NotFound)
    }

    /// Add admin role
    pub fn add_admin(env: Env, admin: Address) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_owner(&env, &caller)?;
        Storage::add_admin(&env, &admin);
        Events::emit_role_update(&env, SorobanString::from_str(&env, "admin"), admin.clone(), true);
        Ok(())
    }

    /// Remove admin role
    pub fn remove_admin(env: Env, admin: Address) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_owner(&env, &caller)?;
        Storage::remove_admin(&env, &admin);
        Events::emit_role_update(&env, SorobanString::from_str(&env, "admin"), admin.clone(), false);
        Ok(())
    }

    /// Add minter role
    pub fn add_minter(env: Env, minter: Address) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_admin(&env, &caller)?;
        Storage::add_minter(&env, &minter);
        Events::emit_role_update(&env, SorobanString::from_str(&env, "minter"), minter.clone(), true);
        Ok(())
    }

    /// Remove minter role
    pub fn remove_minter(env: Env, minter: Address) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_admin(&env, &caller)?;
        Storage::remove_minter(&env, &minter);
        Events::emit_role_update(&env, SorobanString::from_str(&env, "minter"), minter.clone(), false);
        Ok(())
    }

    /// Add burner role
    pub fn add_burner(env: Env, burner: Address) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_admin(&env, &caller)?;
        Storage::add_burner(&env, &burner);
        Events::emit_role_update(&env, SorobanString::from_str(&env, "burner"), burner.clone(), true);
        Ok(())
    }

    /// Pause contract (admin only)
    pub fn pause(env: Env) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_admin(&env, &caller)?;
        let mut config = Storage::get_config(&env)
            .ok_or(ContractError::ContractNotInitialized)?;
        config.is_paused = true;
        Storage::set_config(&env, &config);
        Events::emit_pause(&env, true);
        Ok(())
    }

    /// Unpause contract (admin only)
    pub fn unpause(env: Env) -> Result<(), ContractError> {
        let caller = crate::utils::Utils::get_invoker(&env);
        AccessControl::require_admin(&env, &caller)?;
        let mut config = Storage::get_config(&env)
            .ok_or(ContractError::ContractNotInitialized)?;
        config.is_paused = false;
        Storage::set_config(&env, &config);
        Events::emit_pause(&env, false);
        Ok(())
    }
}
