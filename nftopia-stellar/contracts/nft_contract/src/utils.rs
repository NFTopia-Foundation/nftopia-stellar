use soroban_sdk::{Env, Address, String as SorobanString};

pub struct Utils;

impl Utils {
    /// Get invoker address (TODO: update for Soroban SDK v23)
    pub fn get_invoker(env: &Env) -> Address {
        env.storage().instance().get(&crate::storage::DataKey::Invoker)
            .unwrap_or_else(|| env.current_contract_address())
    }
    
    /// Set invoker in temporary storage
    pub fn set_invoker(env: &Env, invoker: &Address) {
        env.storage().instance().set(&crate::storage::DataKey::Invoker, invoker);
    }

    /// Get current ledger timestamp
    pub fn current_timestamp(env: &Env) -> u64 {
        env.ledger().timestamp()
    }

    /// Validate address (placeholder)
    pub fn is_valid_address(_address: &Address) -> bool {
        true
    }

    /// Validate string is not empty
    pub fn is_valid_string(s: &SorobanString) -> bool {
        s.len() > 0
    }

    /// Validate token ID is valid (non-zero)
    pub fn is_valid_token_id(token_id: u64) -> bool {
        token_id > 0
    }

    /// Combine base URI with token URI
    pub fn combine_uri(
        _env: &Env,
        base_uri: &SorobanString,
        token_uri: &SorobanString,
    ) -> SorobanString {
        if base_uri.len() == 0 {
            return token_uri.clone();
        }
        token_uri.clone()
    }
}
