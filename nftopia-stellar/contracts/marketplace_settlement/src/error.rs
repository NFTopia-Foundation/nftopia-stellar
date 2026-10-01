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

// Separate enum for dispute arbitration, oracle and escrow-settlement errors
//
// These live outside `SettlementError` because it is at the 50-case spec limit.
// Following the `PauseError` / `SwapTimeoutError` pattern, each case has a `From`
// mapping into `SettlementError`, which necessarily collapses some of them onto
// shared codes:
//
// * `TimeoutNotReached` folds onto `InvalidState`, the same choice
//   `SwapTimeoutError::NotYetExpired` makes for "the deadline has not passed".
// * `OracleNotRegistered` and `OracleInactive` both fold onto `Unauthorized`,
//   which is also what a missing `require_auth` produces.
//
// Dispute entrypoints return `SettlementError` so the contract keeps one public
// error type; the distinct `DisputeError` codes are what internal callers match on.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum DisputeError {
    /// Caller is neither the primary admin nor in the dispute admin registry.
    NotAdmin = 1,
    /// No oracle is registered at the supplied address.
    OracleNotRegistered = 2,
    /// The registered oracle has been deactivated.
    OracleInactive = 3,
    /// An oracle is already registered at that address.
    OracleAlreadyRegistered = 4,
    /// The requested resolution is not one of the four known outcomes.
    InvalidResolution = 5,
    /// A timeout-triggered resolution was attempted before the deadline.
    TimeoutNotReached = 6,
    /// The dispute's escrow has already been paid out.
    AlreadySettled = 7,
    /// Nothing is escrowed for the disputed transaction.
    NoEscrowedFunds = 8,
    /// A split basis-point value was above 10_000.
    InvalidSplitBps = 9,
    /// The supplied `DisputeConfig` is internally inconsistent.
    InvalidDisputeConfig = 10,
    /// The arbitrator registry has no eligible arbitrator.
    NoEligibleArbitrators = 11,
    /// A vote value other than 0 (against) or 1 (for the initiator).
    InvalidVote = 12,
}

// Helper to convert DisputeError to SettlementError
impl From<DisputeError> for SettlementError {
    fn from(err: DisputeError) -> Self {
        match err {
            DisputeError::NotAdmin => SettlementError::NotAdmin,
            DisputeError::OracleNotRegistered => SettlementError::Unauthorized,
            DisputeError::OracleInactive => SettlementError::Unauthorized,
            DisputeError::OracleAlreadyRegistered => SettlementError::AlreadyExists,
            DisputeError::InvalidResolution => SettlementError::InvalidState,
            DisputeError::TimeoutNotReached => SettlementError::InvalidState,
            DisputeError::AlreadySettled => SettlementError::DisputeAlreadyResolved,
            DisputeError::NoEscrowedFunds => SettlementError::NotFound,
            DisputeError::InvalidSplitBps => SettlementError::InvalidAmount,
            DisputeError::InvalidDisputeConfig => SettlementError::InvalidState,
            DisputeError::NoEligibleArbitrators => SettlementError::InsufficientArbitrators,
            DisputeError::InvalidVote => SettlementError::InvalidAmount,
        }
    }
}

// Separate enum for withdrawal-anomaly-monitoring errors
//
// These live outside `SettlementError` because it is at the 50-case spec limit.
// `WithdrawalPatternMonitor` (security/frontrun_protection.rs) returns these
// codes directly rather than converting through `SettlementError`, since it is
// not yet wired into a public entrypoint.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum WithdrawalAnomalyError {
    /// The supplied `WithdrawalAnomalyConfig` is internally inconsistent (a
    /// zero threshold, a negative spike floor, or a history_limit shorter
    /// than max_withdrawals_per_window).
    InvalidConfig = 1,
    /// `clear_hold` was called for an account with no outstanding hold.
    NoHold = 2,
}

// Helper to convert WithdrawalAnomalyError to SettlementError
impl From<WithdrawalAnomalyError> for SettlementError {
    fn from(err: WithdrawalAnomalyError) -> Self {
        match err {
            WithdrawalAnomalyError::InvalidConfig => SettlementError::InvalidState,
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
