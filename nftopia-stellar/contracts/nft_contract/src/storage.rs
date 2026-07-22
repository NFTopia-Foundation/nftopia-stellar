use soroban_sdk::{Address, contracttype};

#[derive(Clone)]
#[contracttype]
#[allow(dead_code)]
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
#[allow(dead_code)]
pub const BATCH_RATE_WINDOW: u64 = 100; // ledger sequences
pub const MAX_ROYALTY_BPS: u32 = 10_000; // 100%
pub const MAX_SUPPLY_HARD_CAP: u64 = 1_000_000;
