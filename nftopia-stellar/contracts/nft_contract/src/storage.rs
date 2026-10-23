use soroban_sdk::{Address, contracttype};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // Contract-level configuration
    Admin,
    CollectionConfig,
    TotalSupply,
    NextTokenId,
    IsPaused,
    MetadataFrozen,
    BaseUri,

    // Per-token data
    TokenData(u64),
    TokenOwner(u64),
    TokenApproved(u64),

    // Per-address data
    Balance(Address),
    OwnerTokenHead(Address),
    OwnerTokenPrev(u64),
    OwnerTokenNext(u64),
    OperatorApproval(Address, Address), // (owner, operator)

    // Role-based access control
    Role(Address, u32), // (address, role_discriminant)

    // Royalty
    DefaultRoyalty,
    TokenRoyalty(u64),

    // Rate limiting: tracks last batch timestamp per caller
    LastBatchTime(Address),
    BatchCount(Address),
}

pub const MAX_BATCH_SIZE: u32 = 50;
pub const MAX_OWNER_TOKENS_PAGE: u32 = 50;
pub const BATCH_RATE_WINDOW: u64 = 100; // ledger sequences
pub const MAX_ROYALTY_BPS: u32 = 10_000; // 100%

/// Absolute hard cap for any collection. No collection can exceed this limit.
/// This is the maximum total supply that can ever be minted across any collection.
pub const MAX_SUPPLY_HARD_CAP: u64 = 1_000_000;

/// Minimum supply cap that can be set. Prevents zero-supply collections.
pub const MIN_SUPPLY_CAP: u64 = 1;

/// Validate that a supply cap is within acceptable bounds.
///
/// # Arguments
/// * `cap` - The supply cap to validate
///
/// # Returns
/// * `true` if the cap is valid (>= MIN_SUPPLY_CAP and <= MAX_SUPPLY_HARD_CAP)
/// * `false` otherwise
pub fn is_valid_supply_cap(cap: u64) -> bool {
    (MIN_SUPPLY_CAP..=MAX_SUPPLY_HARD_CAP).contains(&cap)
}

/// Validates a supply cap, returning an error if invalid.
///
/// # Arguments
/// * `cap` - The supply cap to validate
///
/// # Returns
/// * `Ok(())` if valid
/// * `Err(ContractError::InvalidSupplyCap)` if invalid
pub fn validate_supply_cap(cap: u64) -> Result<(), crate::error::ContractError> {
    if cap < MIN_SUPPLY_CAP {
        return Err(crate::error::ContractError::SupplyCapTooLow);
    }
    if cap > MAX_SUPPLY_HARD_CAP {
        return Err(crate::error::ContractError::SupplyCapTooHigh);
    }
    Ok(())
}

/// Checks if minting would exceed the supply cap.
///
/// # Arguments
/// * `total_supply` - Current total supply
/// * `amount` - Amount to mint
/// * `max_supply` - Maximum supply cap
///
/// # Returns
/// * `true` if the mint would exceed the cap
/// * `false` otherwise
pub fn would_exceed_supply_cap(total_supply: u64, amount: u64, max_supply: u64) -> bool {
    total_supply
        .checked_add(amount)
        .is_none_or(|new_total| new_total > max_supply)
}

/// Checks if a supply cap update is valid (cannot be below current supply).
///
/// # Arguments
/// * `new_cap` - The proposed new cap
/// * `current_supply` - Current total supply
///
/// # Returns
/// * `true` if the update is valid (new_cap >= current_supply)
/// * `false` otherwise
pub fn is_valid_cap_update(new_cap: u64, current_supply: u64) -> bool {
    new_cap >= current_supply && is_valid_supply_cap(new_cap)
}
