use soroban_sdk::contracterror;

/// Contract-specific errors for the NFT contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Caller is not authorized for the operation.
    NotAuthorized = 1,
    /// Contract has already been initialized.
    AlreadyInitialized = 2,
    /// Token or resource not found.
    NotFound = 3,
    /// Insufficient balance for operation.
    InsufficientBalance = 4,
    /// Invalid amount or parameter.
    InvalidAmount = 5,
    /// Collection max supply exceeded.
    SupplyLimitExceeded = 6,
    /// Contract or minting is paused.
    ContractPaused = 7,
    /// Invalid royalty (e.g. > 10000 basis points).
    InvalidRoyalty = 8,
    /// Invalid recipient address.
    InvalidRecipient = 9,
    /// Token already exists (duplicate mint).
    TokenAlreadyExists = 10,
    /// Token does not exist.
    TokenNotFound = 11,
    /// Approval required but not granted.
    NotApproved = 12,
    /// Receiver contract rejected the transfer (safe_transfer).
    TransferRejected = 13,
    /// Metadata is frozen and cannot be updated.
    MetadataFrozen = 14,
    /// Invalid token ID.
    InvalidTokenId = 15,
    /// Role-based access denied.
    MissingRole = 16,
    /// Caller not in whitelist for minting.
    NotWhitelisted = 17,
    /// Reentrancy detected.
    ReentrancyDetected = 18,
    /// Batch length mismatch (e.g. recipients vs metadata).
    BatchLengthMismatch = 19,
    /// Burn confirmation flag required.
    BurnNotConfirmed = 20,
    /// Arithmetic overflow or underflow.
    Overflow = 21,
}
