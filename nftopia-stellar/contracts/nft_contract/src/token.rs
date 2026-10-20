use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::storage::{
    DataKey, MAX_BATCH_SIZE, MAX_SUPPLY_HARD_CAP, validate_supply_cap, would_exceed_supply_cap,
};
use crate::transfer;
use crate::types::{CollectionConfig, RoyaltyInfo, TokenAttribute, TokenData};
use soroban_sdk::{Address, Env, String, Vec};

fn next_token_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(1u64);
    env.storage()
        .instance()
        .set(&DataKey::NextTokenId, &(id + 1));
    id
}

/// Checks if minting is allowed based on the supply cap.
///
/// # Validation
/// - Requires CollectionConfig to exist (NotFound if missing)
/// - Requires max_supply to be set (mandatory)
/// - Validates that total_supply + 1 <= max_supply
///
/// # Returns
/// * `Ok(())` if minting is allowed
/// * `Err(ContractError::NotFound)` if CollectionConfig not found
/// * `Err(ContractError::SupplyLimitExceeded)` if supply cap would be exceeded
fn check_supply(env: &Env) -> Result<(), ContractError> {
    let config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);

    // max_supply is now mandatory (u64, not Option)
    if total >= config.max_supply {
        return Err(ContractError::SupplyLimitExceeded);
    }

    // Additional safety: ensure we never exceed the hard cap even if config is misconfigured
    if total >= MAX_SUPPLY_HARD_CAP {
        return Err(ContractError::SupplyLimitExceeded);
    }

    Ok(())
}

/// Checks if a batch mint of size n would exceed the supply cap.
///
/// # Validation
/// - Requires CollectionConfig to exist
/// - Validates that total_supply + n <= max_supply
/// - Validates that total_supply + n <= MAX_SUPPLY_HARD_CAP
///
/// # Returns
/// * `Ok(())` if the batch fits within the supply cap
/// * `Err(ContractError::SupplyLimitExceeded)` if the batch would exceed the cap
fn check_batch_supply(env: &Env, n: u32) -> Result<(), ContractError> {
    let config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);

    // Check against collection max supply
    if would_exceed_supply_cap(total, n as u64, config.max_supply) {
        return Err(ContractError::SupplyLimitExceeded);
    }

    // Check against hard cap
    if would_exceed_supply_cap(total, n as u64, MAX_SUPPLY_HARD_CAP) {
        return Err(ContractError::SupplyLimitExceeded);
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn mint_one(
    env: &Env,
    caller: &Address,
    to: &Address,
    metadata_uri: String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
    edition_number: Option<u32>,
    total_editions: Option<u32>,
) -> Result<u64, ContractError> {
    check_supply(env)?;

    let token_id = next_token_id(env);
    let default_royalty: RoyaltyInfo = env
        .storage()
        .instance()
        .get(&DataKey::DefaultRoyalty)
        .unwrap_or(RoyaltyInfo {
            recipient: caller.clone(),
            percentage: 0,
        });

    let royalty = royalty_override.unwrap_or(default_royalty);

    let data = TokenData {
        id: token_id,
        owner: to.clone(),
        metadata_uri,
        created_at: env.ledger().timestamp(),
        creator: caller.clone(),
        royalty_percentage: royalty.percentage,
        royalty_recipient: royalty.recipient,
        attributes,
        edition_number,
        total_editions,
    };

    env.storage()
        .persistent()
        .set(&DataKey::TokenData(token_id), &data);
    env.storage()
        .persistent()
        .set(&DataKey::TokenOwner(token_id), to);

    let bal: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Balance(to.clone()), &(bal + 1));

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    let new_total = total + 1;
    env.storage()
        .instance()
        .set(&DataKey::TotalSupply, &new_total);

    // Get config for supply events
    let config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;

    // Emit mint event
    events::emit_mint(env, to.clone(), token_id);

    // Emit supply status event when approaching the cap
    let remaining = get_remaining_supply(env);
    if remaining <= 10 && remaining > 0 {
        events::emit_supply_approaching_cap(env, remaining, config.max_supply);
    }

    // Emit cap reached event when supply hits the cap
    if new_total == config.max_supply {
        events::emit_supply_cap_reached(env, new_total, config.max_supply);
    }

    Ok(token_id)
}

pub fn mint(
    env: &Env,
    caller: &Address,
    to: Address,
    metadata_uri: String,
    attributes: Vec<TokenAttribute>,
    royalty_override: Option<RoyaltyInfo>,
) -> Result<u64, ContractError> {
    access_control::require_minter(env, caller)?;

    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(ContractError::ContractPaused);
    }

    mint_one(
        env,
        caller,
        &to,
        metadata_uri,
        attributes,
        royalty_override,
        None,
        None,
    )
}

pub fn batch_mint(
    env: &Env,
    caller: &Address,
    recipients: Vec<Address>,
    metadata_uris: Vec<String>,
    attributes: Vec<Vec<TokenAttribute>>,
) -> Result<Vec<u64>, ContractError> {
    access_control::require_minter(env, caller)?;

    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(ContractError::ContractPaused);
    }

    let n = recipients.len();
    if n != metadata_uris.len() || n != attributes.len() {
        return Err(ContractError::MismatchedArrays);
    }
    if n == 0 || n > MAX_BATCH_SIZE {
        return Err(ContractError::BatchTooLarge);
    }

    // Check total supply headroom up front using the improved check
    check_batch_supply(env, n)?;

    let mut ids: Vec<u64> = Vec::new(env);
    for i in 0..n {
        let id = mint_one(
            env,
            caller,
            &recipients.get(i).unwrap(),
            metadata_uris.get(i).unwrap(),
            attributes.get(i).unwrap(),
            None,
            None,
            None,
        )?;
        ids.push_back(id);
    }
    Ok(ids)
}

/// Burn a single token.
///
/// Authorization:
/// - Token owner can burn their own token
/// - Accounts with BURNER role can burn any token
///
/// Validation:
/// - Token must exist (TokenNotFound if not)
/// - Token must not be already burned (AlreadyBurned if already burned)
/// - Authorization checked via access_control
///
/// Cleanup:
/// - Removes TokenOwner, TokenData, TokenApproved entries
/// - Decrements owner balance and total supply
/// - Emits Burn event on success
/// - Emits BurnFailed event on failure
pub fn burn(env: &Env, caller: &Address, token_id: u64) -> Result<(), ContractError> {
    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(ContractError::ContractPaused);
    }

    // 1. Validate token exists
    let owner: Address = env
        .storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or_else(|| {
            events::emit_burn_failed(
                env,
                token_id,
                caller.clone(),
                ContractError::TokenNotFound as u32,
            );
            ContractError::TokenNotFound
        })?;

    // 2. Validate not already burned - check if token data exists
    let token_data: Option<TokenData> = env
        .storage()
        .persistent()
        .get(&DataKey::TokenData(token_id));
    if token_data.is_none() {
        events::emit_burn_failed(
            env,
            token_id,
            caller.clone(),
            ContractError::AlreadyBurned as u32,
        );
        return Err(ContractError::AlreadyBurned);
    }

    // 3. Authorization: owner OR burner role
    let is_owner = caller == &owner;
    let is_burner = access_control::has_role(env, caller, crate::types::role::BURNER);

    if !is_owner && !is_burner {
        events::emit_burn_failed(
            env,
            token_id,
            caller.clone(),
            ContractError::NotAuthorized as u32,
        );
        return Err(ContractError::NotAuthorized);
    }

    // 4. Clean up operator approvals for this token
    // Remove TokenApproved entry
    env.storage()
        .persistent()
        .remove(&DataKey::TokenApproved(token_id));

    // 5. Remove token data and ownership
    env.storage()
        .persistent()
        .remove(&DataKey::TokenOwner(token_id));
    env.storage()
        .persistent()
        .remove(&DataKey::TokenData(token_id));
    env.storage()
        .persistent()
        .remove(&DataKey::TokenRoyalty(token_id));

    // 6. Update owner balance
    let bal: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(owner.clone()))
        .unwrap_or(0);
    if bal > 0 {
        env.storage()
            .persistent()
            .set(&DataKey::Balance(owner.clone()), &bal.saturating_sub(1));
    }

    // 7. Update total supply
    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);
    if total > 0 {
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &total.saturating_sub(1));
    }

    // 8. Emit success event
    events::emit_burn(env, owner, token_id);
    Ok(())
}

/// Batch burn multiple tokens in one transaction.
///
/// Authorization:
/// - Each token must be owned by the caller OR caller must have BURNER role
/// - If caller has BURNER role, they can burn any tokens in the batch
/// - If caller does NOT have BURNER role, they must own ALL tokens in the batch
///
/// Behavior:
/// - Burns tokens atomically: if any token fails, the entire transaction reverts
/// - Maximum batch size is MAX_BATCH_SIZE (currently 50)
///
/// Returns:
/// - Ok(()) if all tokens were successfully burned
/// - Error if any token validation fails
pub fn batch_burn(env: &Env, caller: &Address, token_ids: Vec<u64>) -> Result<(), ContractError> {
    // 1. Validate batch size
    let n = token_ids.len();
    if n == 0 || n > MAX_BATCH_SIZE {
        return Err(ContractError::BatchTooLarge);
    }

    // 2. Check if caller has burner role (allows burning any tokens)
    let has_burner_role = access_control::has_role(env, caller, crate::types::role::BURNER);

    // 3. If caller doesn't have burner role, verify they own ALL tokens
    if !has_burner_role {
        for i in 0..n {
            let token_id = token_ids.get(i).unwrap();
            let owner: Address = env
                .storage()
                .persistent()
                .get(&DataKey::TokenOwner(token_id))
                .ok_or(ContractError::TokenNotFound)?;

            if caller != &owner {
                return Err(ContractError::NotAuthorized);
            }
        }
    }

    // 4. Burn each token
    for i in 0..n {
        let token_id = token_ids.get(i).unwrap();
        // Use the single burn function for each token
        // This ensures consistent validation and cleanup
        burn(env, caller, token_id)?;
    }

    Ok(())
}

pub fn transfer(
    env: &Env,
    caller: &Address,
    from: Address,
    to: Address,
    token_id: u64,
) -> Result<(), ContractError> {
    if !transfer::is_approved_or_owner(env, caller, token_id) {
        return Err(ContractError::NotApproved);
    }
    transfer::do_transfer(env, &from, &to, token_id)
}

pub fn safe_transfer_from(
    env: &Env,
    caller: &Address,
    from: Address,
    to: Address,
    token_id: u64,
) -> Result<(), ContractError> {
    if !transfer::is_approved_or_owner(env, caller, token_id) {
        return Err(ContractError::NotApproved);
    }
    transfer::do_transfer(env, &from, &to, token_id)
}

pub fn batch_transfer(
    env: &Env,
    caller: &Address,
    from: Address,
    to: Address,
    token_ids: Vec<u64>,
) -> Result<(), ContractError> {
    let n = token_ids.len();
    if n == 0 || n > MAX_BATCH_SIZE {
        return Err(ContractError::BatchTooLarge);
    }

    for i in 0..n {
        let token_id = token_ids.get(i).unwrap();
        if !transfer::is_approved_or_owner(env, caller, token_id) {
            return Err(ContractError::NotApproved);
        }
        transfer::do_transfer(env, &from, &to, token_id)?;
    }
    Ok(())
}

pub fn owner_of(env: &Env, token_id: u64) -> Result<Address, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or(ContractError::TokenNotFound)
}

pub fn balance_of(env: &Env, owner: &Address) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(owner.clone()))
        .unwrap_or(0)
}

pub fn total_supply(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}

/// Gets the remaining supply available for minting.
///
/// # Returns
/// * The number of tokens that can still be minted before reaching the cap
/// * 0 if the cap has been reached or exceeded
pub fn get_remaining_supply(env: &Env) -> u64 {
    let config: Result<CollectionConfig, _> = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound);

    let total: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);

    match config {
        Ok(config) => config.max_supply.saturating_sub(total),
        Err(_) => 0,
    }
}

/// Updates the maximum supply cap for the collection.
///
/// # Authorization
/// Only the contract admin can call this function.
///
/// # Validation
/// - New cap must be >= MIN_SUPPLY_CAP
/// - New cap must be <= MAX_SUPPLY_HARD_CAP
/// - New cap must be >= current total supply (cannot reduce below existing supply)
///
/// # Returns
/// * `Ok(())` if the cap was successfully updated
/// * `Err(ContractError::NotAuthorized)` if caller is not admin
/// * `Err(ContractError::SupplyCapTooLow)` if cap < MIN_SUPPLY_CAP
/// * `Err(ContractError::SupplyCapTooHigh)` if cap > MAX_SUPPLY_HARD_CAP
/// * `Err(ContractError::SupplyCapBelowCurrentSupply)` if cap < current total supply
pub fn update_max_supply(env: &Env, caller: &Address, new_cap: u64) -> Result<(), ContractError> {
    // Authorization: only admin can update the cap
    if !access_control::has_role(env, caller, crate::types::role::ADMIN) {
        return Err(ContractError::NotAuthorized);
    }

    // Validate the new cap
    validate_supply_cap(new_cap)?;

    // Ensure new cap is not below current supply
    let current_supply: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);

    if new_cap < current_supply {
        return Err(ContractError::SupplyCapBelowCurrentSupply);
    }

    // Update the collection config
    let mut config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;

    let old_cap = config.max_supply;
    config.max_supply = new_cap;

    env.storage()
        .instance()
        .set(&DataKey::CollectionConfig, &config);

    // Emit event for the cap update
    events::emit_supply_cap_updated(env, old_cap, new_cap);

    Ok(())
}

/// Gets the current supply cap.
///
/// # Returns
/// * The current max_supply from CollectionConfig
/// * `Err(ContractError::NotFound)` if CollectionConfig not found
pub fn get_max_supply(env: &Env) -> Result<u64, ContractError> {
    let config: CollectionConfig = env
        .storage()
        .instance()
        .get(&DataKey::CollectionConfig)
        .ok_or(ContractError::NotFound)?;
    Ok(config.max_supply)
}
