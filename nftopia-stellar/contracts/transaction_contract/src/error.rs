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
}
