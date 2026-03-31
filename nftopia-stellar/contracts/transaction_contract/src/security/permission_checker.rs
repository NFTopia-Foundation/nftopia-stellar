//! Permission checker — verifies that the caller has the right to perform
//! an action on a transaction.

use crate::error::TransactionError;
use crate::types::Transaction;
use soroban_sdk::Address;

/// Only the original creator may mutate or execute their transaction.
pub fn assert_creator(tx: &Transaction, caller: &Address) -> Result<(), TransactionError> {
    if tx.creator != *caller {
        return Err(TransactionError::Unauthorized);
    }
    caller.require_auth();
    Ok(())
}

/// Verifies that the caller has already provided their auth and is the creator.
/// Identical to `assert_creator` but kept separate for future role-based expansion.
pub fn assert_can_cancel(tx: &Transaction, caller: &Address) -> Result<(), TransactionError> {
    assert_creator(tx, caller)
}

/// Check that a signer address is the one adding the signature.
pub fn assert_signer(signer: &Address) {
    signer.require_auth();
}
