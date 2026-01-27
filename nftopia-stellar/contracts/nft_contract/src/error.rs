use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // General errors (0-99)
    Unauthorized = 1,
    NotFound = 2,
    InvalidInput = 3,
    AlreadyExists = 4,
    Frozen = 5,

    // Token errors (100-199)
    TokenNotFound = 100,
    TokenAlreadyMinted = 101,
    InvalidTokenId = 102,
    NotOwner = 103,
    NotApproved = 104,
    TransferToZeroAddress = 105,
    TransferFromZeroAddress = 106,
    MaxSupplyExceeded = 107,

    // Approval errors (200-299)
    ApprovalToCurrentOwner = 200,
    ApprovalToCaller = 201,
    InvalidApproval = 202,

    // Metadata errors (300-399)
    MetadataFrozen = 300,
    InvalidMetadataUri = 301,
    MetadataNotFound = 302,

    // Royalty errors (400-499)
    InvalidRoyaltyPercentage = 400,
    RoyaltyOverflow = 401,
    InvalidRoyaltyRecipient = 402,

    // Access control errors (500-599)
    MissingRole = 500,
    InvalidRole = 501,

    // Transfer errors (600-699)
    TransferFailed = 600,
    SafeTransferFailed = 601,
    BatchTransferFailed = 602,

    // Mint errors (700-799)
    MintFailed = 700,
    BatchMintFailed = 701,
    MintPriceNotMet = 702,

    // Burn errors (800-899)
    BurnFailed = 800,
    BurnNotAuthorized = 801,

    // Contract state errors (900-999)
    ContractPaused = 900,
    ContractNotInitialized = 901,
}
