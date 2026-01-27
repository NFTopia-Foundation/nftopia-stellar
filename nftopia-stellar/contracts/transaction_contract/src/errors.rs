use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum TransactionError {
    NotFound = 1,
    InvalidState = 2,
    Unauthorized = 3,
    ExecutionFailed = 4,
}
