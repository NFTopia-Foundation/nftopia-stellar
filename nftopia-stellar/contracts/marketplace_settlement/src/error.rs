use soroban_sdk::{contracterror, contracttype};

// Primary error enum - keep under the limit
//
// The limit is 50 cases (the contract spec XDR caps `ScSpecUdtErrorEnumV0::cases`)
// and this enum is now at it. Adding a variant fails the build with a
// `LengthExceedsMax` panic from the `contracterror` macro, so new error domains go
// in their own enum with a `From` impl into this one — see `PauseError` and
// `SwapTimeoutError` below.
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
    // TransactionDisputed = 104,
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
    BidBelowMinimumIncrement = 208,

    // Payment errors
    PaymentFailed = 300,
    InsufficientPayment = 301,
    InvalidCurrency = 302,
    AssetNotSupported = 303,
    /// Returned when a native XLM transfer fails (e.g. no SAC address configured)
    NativeAssetTransferFailed = 304,
    /// Returned when a native XLM balance query fails
    NativeAssetBalanceFailed = 305,

    // Royalty errors
    RoyaltyCalculationFailed = 400,
    InvalidRoyaltyPercentage = 401,
    RoyaltyDistributionFailed = 402,
    /// Royalty percentage exceeds the admin-configured maximum cap
    RoyaltyExceedsMaxCap = 403,

    // Dispute errors
    DisputeNotFound = 500,
    DisputeAlreadyResolved = 501,
    InvalidDisputeState = 502,
    ArbitrationFailed = 503,
    InsufficientArbitrators = 504,

    // Security errors
    ReentrancyDetected = 600,
    FrontRunningDetected = 601,
    // InvalidSignature = 602,
    CooldownActive = 603,
    ContractPaused = 604,

    // Fee errors
    FeeCalculationFailed = 700,
    InvalidFeeConfig = 701,
    FeeExemptionNotAllowed = 702,
    FeeAlreadyInitialized = 703,

    // Admin errors
    NotAdmin = 800,
    EmergencyWithdrawalNotAllowed = 801,
    AddressBlocked = 802,

    // Math errors
    Overflow = 900,
    Underflow = 901,
    DivisionByZero = 902,
}

// Separate enum for pause errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum PauseError {
    ModulePaused = 1,
    PauseTimelockActive = 2,
    PauseTimelockExpired = 3,
    PauseAlreadyScheduled = 4,
    PauseNotScheduled = 5,
    PauseCancellationNotAllowed = 6,
    NotPaused = 7,
}

// Helper to convert PauseError to SettlementError
impl From<PauseError> for SettlementError {
    fn from(err: PauseError) -> Self {
        match err {
            PauseError::ModulePaused => SettlementError::ContractPaused,
            PauseError::PauseTimelockActive => SettlementError::ContractPaused,
            PauseError::PauseTimelockExpired => SettlementError::ContractPaused,
            PauseError::PauseAlreadyScheduled => SettlementError::ContractPaused,
            PauseError::PauseNotScheduled => SettlementError::ContractPaused,
            PauseError::PauseCancellationNotAllowed => SettlementError::ContractPaused,
            PauseError::NotPaused => SettlementError::ContractPaused,
        }
    }
}

// Separate enum for atomic swap / escrow timeout errors
//
// These live outside `SettlementError` because it is at the 50-case spec limit.
// The timeout-specific entrypoints (`expire_swap`, `reclaim_expired_escrow`,
// `update_swap_timeout_config`) return these codes directly so callers can tell the
// cases apart; the mixed-concern lifecycle functions convert through the `From` impl
// below, which necessarily collapses some of them onto existing codes.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum SwapTimeoutError {
    /// The swap is past `expires_at` plus its grace period.
    SwapExpired = 1,
    /// A timeout-triggered action was attempted before its deadline passed.
    /// Covers both the swap deadline and the per-holding escrow backstop.
    NotYetExpired = 2,
    /// The swap is already `Executed` or `Failed`.
    SwapAlreadyFinalized = 3,
    /// The requested swap lifetime is zero or above `max_swap_duration`.
    InvalidSwapDuration = 4,
    /// The supplied `SwapTimeoutConfig` would disable expiry or overflow.
    InvalidTimeoutConfig = 5,
    SwapNotFound = 6,
}

// Helper to convert SwapTimeoutError to SettlementError
impl From<SwapTimeoutError> for SettlementError {
    fn from(err: SwapTimeoutError) -> Self {
        match err {
            // `TransactionExpired` is the settlement-level code for a swap whose
            // deadline has passed, distinct from `Expired` used for sale expiry.
            SwapTimeoutError::SwapExpired => SettlementError::TransactionExpired,
            SwapTimeoutError::NotYetExpired => SettlementError::InvalidState,
            SwapTimeoutError::SwapAlreadyFinalized => SettlementError::InvalidTransactionState,
            SwapTimeoutError::InvalidSwapDuration => SettlementError::InvalidAmount,
            SwapTimeoutError::InvalidTimeoutConfig => SettlementError::InvalidState,
            SwapTimeoutError::SwapNotFound => SettlementError::NotFound,
        }
    }
}

// Separate enum for withdrawal-anomaly detection
//
// Like `SwapTimeoutError`, this lives outside `SettlementError` (which is at the
// 50-case spec limit). `WithdrawalPatternMonitor` returns these codes directly so
// an operator can tell "your thresholds are invalid" apart from "this account is
// on a hold"; the `From` impl collapses them onto the closest settlement-level
// code for callers that need a single error type.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum WithdrawalAnomalyError {
    /// The supplied `WithdrawalAnomalyConfig` would disable detection.
    InvalidConfig = 1,
    /// A previous anomaly already put this account on a withdrawal hold.
    HoldActive = 2,
    /// No hold is outstanding for this account.
    NoHold = 3,
}

impl From<WithdrawalAnomalyError> for SettlementError {
    fn from(err: WithdrawalAnomalyError) -> Self {
        match err {
            WithdrawalAnomalyError::InvalidConfig => SettlementError::InvalidState,
            WithdrawalAnomalyError::HoldActive => SettlementError::CooldownActive,
            WithdrawalAnomalyError::NoHold => SettlementError::NotFound,
        }
    }
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
