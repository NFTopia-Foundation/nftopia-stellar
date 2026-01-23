use soroban_sdk::{Address, Env};
use crate::storage::Storage;
use crate::error::ContractError;

pub struct AccessControl;

impl AccessControl {
    /// Check if caller has owner role
    pub fn require_owner(env: &Env, caller: &Address) -> Result<(), ContractError> {
        if Storage::is_owner(env, caller) {
            Ok(())
        } else {
            Err(ContractError::Unauthorized)
        }
    }

    /// Check if caller has admin role
    pub fn require_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
        if Storage::is_admin(env, caller) || Storage::is_owner(env, caller) {
            Ok(())
        } else {
            Err(ContractError::Unauthorized)
        }
    }

    /// Check if caller has minter role
    pub fn require_minter(env: &Env, caller: &Address) -> Result<(), ContractError> {
        if Storage::is_minter(env, caller) {
            Ok(())
        } else {
            Err(ContractError::Unauthorized)
        }
    }

    /// Check if caller has burner role
    pub fn require_burner(env: &Env, caller: &Address) -> Result<(), ContractError> {
        if Storage::is_burner(env, caller) {
            Ok(())
        } else {
            Err(ContractError::Unauthorized)
        }
    }

    /// Check if caller has metadata updater role
    pub fn require_metadata_updater(env: &Env, caller: &Address) -> Result<(), ContractError> {
        if Storage::is_metadata_updater(env, caller) {
            Ok(())
        } else {
            Err(ContractError::Unauthorized)
        }
    }

    /// Check if contract is not paused
    pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let config = Storage::get_config(env)
            .ok_or(ContractError::ContractNotInitialized)?;
        
        if config.is_paused {
            Err(ContractError::ContractPaused)
        } else {
            Ok(())
        }
    }

    /// Check if caller is token owner or approved
    pub fn require_token_owner_or_approved(
        env: &Env,
        caller: &Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        let token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        // Check if caller is owner
        if token.owner == *caller {
            return Ok(());
        }

        // Check if caller is approved for this token
        if let Some(approved) = Storage::get_approval(env, token_id) {
            if approved == *caller {
                return Ok(());
            }
        }

        // Check if caller is operator approved
        if Storage::is_operator_approved(env, &token.owner, caller) {
            return Ok(());
        }

        Err(ContractError::NotApproved)
    }

    /// Check if caller is token owner
    pub fn require_token_owner(
        env: &Env,
        caller: &Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        let token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        if token.owner == *caller {
            Ok(())
        } else {
            Err(ContractError::NotOwner)
        }
    }
}
