use soroban_sdk::{Env, Symbol, Address, symbol_short, Bytes};
use crate::error::SettlementError;
use crate::events::{emit_reentrancy_detected, ReentrancyDetectedEvent};

// Storage keys
const REENTRANCY_GUARD: Symbol = symbol_short!("reentrant");
const FUNCTION_LOCKS: Symbol = symbol_short!("func_lck");

/// Reentrancy guard to prevent reentrant calls
pub struct ReentrancyGuard;

impl ReentrancyGuard {
    /// Execute a function with reentrancy protection
    pub fn execute<F, R>(env: &Env, caller: &Address, function_name: &str, f: F) -> Result<R, SettlementError>
    where
        F: FnOnce() -> Result<R, SettlementError>,
    {
        // Check if we're already in a protected function
        let is_locked: bool = env.storage().instance().get(&REENTRANCY_GUARD).unwrap_or(false);

        if is_locked {
            // Emit reentrancy detection event
            let event = ReentrancyDetectedEvent {
                caller: caller.clone(),
                function: Bytes::from_slice(env, function_name.as_bytes()),
                timestamp: env.ledger().timestamp(),
            };
            emit_reentrancy_detected(env, event);

            return Err(SettlementError::ReentrancyDetected);
        }

        // Set the reentrancy lock
        env.storage().instance().set(&REENTRANCY_GUARD, &true);

        // Execute the function
        let result = f();

        // Always clear the lock, even if the function failed
        env.storage().instance().set(&REENTRANCY_GUARD, &false);

        result
    }

    /// Check if currently in a reentrant call
    pub fn is_reentrant(env: &Env) -> bool {
        env.storage().instance().get(&REENTRANCY_GUARD).unwrap_or(false)
    }
}

/// Function-specific lock to prevent concurrent execution of specific functions
pub struct FunctionLock;

impl FunctionLock {
    /// Execute a function with function-specific locking
    pub fn execute<F, R>(
        env: &Env,
        function_key: &Symbol,
        _caller: &Address,
        f: F
    ) -> Result<R, SettlementError>
    where
        F: FnOnce() -> Result<R, SettlementError>,
    {
        let mut locks: soroban_sdk::Map<Symbol, bool> = env
            .storage()
            .instance()
            .get(&FUNCTION_LOCKS)
            .unwrap_or(soroban_sdk::Map::new(env));

        // Check if function is already locked
        if let Some(true) = locks.get(function_key.clone()) {
            return Err(SettlementError::ReentrancyDetected);
        }

        // Set the function lock
        locks.set(function_key.clone(), true);
        env.storage().instance().set(&FUNCTION_LOCKS, &locks);

        // Execute the function
        let result = f();

        // Clear the function lock
        locks.set(function_key.clone(), false);
        env.storage().instance().set(&FUNCTION_LOCKS, &locks);

        result
    }

    /// Check if a specific function is currently locked
    pub fn is_locked(env: &Env, function_key: &Symbol) -> bool {
        let locks: soroban_sdk::Map<Symbol, bool> = env
            .storage()
            .instance()
            .get(&FUNCTION_LOCKS)
            .unwrap_or(soroban_sdk::Map::new(env));

        locks.get(function_key.clone()).unwrap_or(false)
    }
}

/// Non-reentrant modifier for contract functions
#[macro_export]
macro_rules! non_reentrant {
    ($env:expr, $caller:expr, $function_name:expr, $body:block) => {
        {
            use crate::security::reentrancy_guard::ReentrancyGuard;
            ReentrancyGuard::execute($env, $caller, $function_name, || $body)
        }
    };
}

/// Function-specific lock modifier
#[macro_export]
macro_rules! function_lock {
    ($env:expr, $function_key:expr, $caller:expr, $body:block) => {
        {
            use crate::security::reentrancy_guard::FunctionLock;
            FunctionLock::execute($env, $function_key, $caller, || $body)
        }
    };
}