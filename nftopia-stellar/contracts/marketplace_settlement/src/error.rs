use soroban_sdk::{contracterror, contracttype};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum SettlementError {
    // General errors
    Unauthorized = 1,
    NotFound = 2,
    AlreadyExists = 3,
    InvalidState = 4,
    Expired = 5,
    InsufficientFunds = 6,
    InvalidAmount = 7,

    // Transaction errors
    TransactionNotFound = 100,
    TransactionAlreadyExecuted = 101,
    TransactionExpired = 102,
    TransactionCancelled = 103,
    TransactionDisputed = 104,
    InvalidTransactionState = 105,

    // Auction errors
    AuctionNotFound = 200,
    AuctionAlreadyEnded = 201,
    AuctionNotStarted = 202,
    BidTooLow = 203,
    InvalidBidIncrement = 204,
    AuctionReserveNotMet = 205,
    BidRevealFailed = 206,
    CommitmentMismatch = 207,

    // Payment errors
    PaymentFailed = 300,
    InsufficientPayment = 301,
    InvalidCurrency = 302,
    AssetNotSupported = 303,

    // Royalty errors
    RoyaltyCalculationFailed = 400,
    InvalidRoyaltyPercentage = 401,
    RoyaltyDistributionFailed = 402,

    // Dispute errors
    DisputeNotFound = 500,
    DisputeAlreadyResolved = 501,
    InvalidDisputeState = 502,
    ArbitrationFailed = 503,
    InsufficientArbitrators = 504,

    // Security errors
    ReentrancyDetected = 600,
    FrontRunningDetected = 601,
    InvalidSignature = 602,
    CooldownActive = 603,

    // Fee errors
    FeeCalculationFailed = 700,
    InvalidFeeConfig = 701,
    FeeExemptionNotAllowed = 702,

    // Admin errors
    NotAdmin = 800,
    EmergencyWithdrawalNotAllowed = 801,

    // Math errors
    Overflow = 900,
    Underflow = 901,
    DivisionByZero = 902,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EmergencyWithdrawalReason {
    StuckTransaction,
    SecurityBreach,
    PlatformMaintenance,
    UserRequest,
}

// Dispute resolution constants (u64 values)
pub const DISPUTE_RESOLUTION_NOT_RESOLVED: u64 = 0;
pub const DISPUTE_RESOLUTION_REFUND_BUYER: u64 = 1;
pub const DISPUTE_RESOLUTION_RELEASE_TO_SELLER: u64 = 2;
pub const DISPUTE_RESOLUTION_SPLIT_FUNDS: u64 = 3;
pub const DISPUTE_RESOLUTION_CANCEL_TRANSACTION: u64 = 4;