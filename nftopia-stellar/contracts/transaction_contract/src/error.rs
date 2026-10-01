use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TransactionError {
    TransactionNotFound = 1,
    Unauthorized = 2,
    InvalidStateTransition = 3,
    InvalidOperation = 4,
    DependencyNotMet = 5,
    GasLimitExceeded = 6,
    SignatureMissing = 7,
    AlreadyFinalized = 8,
    AtomicityViolation = 9,
    DuplicateOperationId = 10,
    ResourceLimitExceeded = 11,
    OperationTimedOut = 12,
    /// The dependency graph contains a cycle and therefore has no valid
    /// topological order (#290).
    CircularDependency = 13,
    /// A ledger entry backing the transaction (or one of its operations) is
    /// not guaranteed to stay live long enough to complete the run (#290).
    TtlExpired = 14,
    /// An operator-provided configuration (TTL policy / fee ladder) is invalid.
    InvalidConfiguration = 15,
}
