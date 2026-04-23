use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
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
    NotOwner = 11,
    NotApproved = 12,
    InvalidBatchSize = 13,
    BatchTooLarge = 14,
    InvalidRecipient = 15,
    RoleAlreadyGranted = 16,
    RoleNotGranted = 17,
    NotMinter = 18,
    NotBurner = 19,
    InvalidUri = 20,
    ArithmeticError = 21,
    MismatchedArrays = 22,
}
