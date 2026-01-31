//! Reentrancy protection for critical operations (mint, burn, transfer).

use crate::error::ContractError;
use crate::storage::DataKey;
use soroban_sdk::Env;

/// Acquires the reentrancy lock. Returns error if already locked.
#[inline]
pub fn acquire(env: &Env) -> Result<(), ContractError> {
    let locked: bool = env
        .storage()
        .instance()
        .get(&DataKey::ReentrancyLock)
        .unwrap_or(false);
    if locked {
        return Err(ContractError::ReentrancyDetected);
    }
    env.storage()
        .instance()
        .set(&DataKey::ReentrancyLock, &true);
    Ok(())
}

/// Releases the reentrancy lock. Call after critical section (on both success and failure paths).
#[inline]
pub fn release(env: &Env) {
    env.storage()
        .instance()
        .set(&DataKey::ReentrancyLock, &false);
}
