use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    NotFound = 3,
    InsufficientBalance = 4,
    InvalidAmount = 5,
    SupplyLimitExceeded = 6,
    CollectionNotFound = 7,
    NotMinter = 8,
    ContractPaused = 9,
    InvalidRoyalty = 10,
    InvalidRecipient = 11,
    TokenAlreadyExists = 12,
}
