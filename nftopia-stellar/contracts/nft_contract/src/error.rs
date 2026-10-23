use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // -------------------------------------------------------------------------
    // Authorization & Access Control (1-10)
    // -------------------------------------------------------------------------
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    NotFound = 3,
    TokenNotFound = 4,
    InvalidAmount = 5,
    SupplyLimitExceeded = 6,
    ContractPaused = 7,
    InvalidRoyalty = 8,
    TokenAlreadyExists = 9,
    MetadataFrozen = 10,

    // -------------------------------------------------------------------------
    // Ownership & Approval (11-15)
    // -------------------------------------------------------------------------
    NotOwner = 11,
    NotApproved = 12,
    InvalidBatchSize = 13,
    BatchTooLarge = 14,
    InvalidRecipient = 15,

    // -------------------------------------------------------------------------
    // Role Management (16-19)
    // -------------------------------------------------------------------------
    RoleAlreadyGranted = 16,
    RoleNotGranted = 17,
    NotMinter = 18,
    NotBurner = 19,

    // -------------------------------------------------------------------------
    // Metadata & URI (20)
    // -------------------------------------------------------------------------
    InvalidUri = 20,

    // -------------------------------------------------------------------------
    // Arithmetic & Validation (21-24)
    // -------------------------------------------------------------------------
    ArithmeticError = 21,
    MismatchedArrays = 22,
    AlreadyBurned = 23,
    BurnNotAllowed = 24,

    // -------------------------------------------------------------------------
    // Supply Cap Errors (30-35)
    // -------------------------------------------------------------------------
    /// Supply cap cannot be zero. Minimum supply cap is 1.
    SupplyCapTooLow = 30,

    /// Supply cap exceeds the hard cap (MAX_SUPPLY_HARD_CAP = 1,000,000).
    SupplyCapTooHigh = 31,

    /// Cannot reduce supply cap below current total supply.
    /// New cap must be >= current total supply.
    SupplyCapBelowCurrentSupply = 32,

    /// Supply cap is required but was not set (should never happen after
    /// migration, as max_supply is now mandatory).
    SupplyCapNotSet = 33,

    /// max_supply exceeds MAX_SUPPLY_HARD_CAP during initialization.
    MaxSupplyExceedsHardCap = 34,

    /// Pagination limit must be between 1 and MAX_OWNER_TOKENS_PAGE.
    InvalidPaginationLimit = 35,

    /// Pagination cursor does not identify a token currently owned by the queried address.
    InvalidPaginationCursor = 36,
}
