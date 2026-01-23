use soroban_sdk::{Address, Env, Bytes, Vec};
use crate::storage::Storage;
use crate::access_control::AccessControl;
use crate::error::ContractError;
use crate::events::Events;

pub struct Transfer;

impl Transfer {
    /// Transfer token from one address to another
    pub fn transfer_from(
        env: &Env,
        caller: &Address,
        from: &Address,
        to: &Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        // Validate addresses

        // Check contract is not paused
        AccessControl::require_not_paused(env)?;

        // Get token
        let token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        // Verify ownership
        if token.owner != *from {
            return Err(ContractError::NotOwner);
        }

        // Check authorization
        if *caller != *from {
            // Check if caller is approved
            if let Some(approved) = Storage::get_approval(env, token_id) {
                if approved != *caller {
                    return Err(ContractError::NotApproved);
                }
            } else if !Storage::is_operator_approved(env, from, caller) {
                return Err(ContractError::NotApproved);
            }
        }

        // Perform transfer
        Self::_transfer(env, from, to, token_id)?;

        Ok(())
    }

    /// Safe transfer with receiver contract validation
    pub fn safe_transfer_from(
        env: &Env,
        caller: &Address,
        from: &Address,
        to: &Address,
        token_id: u64,
        _data: Option<Bytes>,
    ) -> Result<(), ContractError> {
        Self::transfer_from(env, caller, from, to, token_id)?;
        // TODO: Validate contract receiver implements onERC721Received
        Ok(())
    }

    /// Internal transfer function
    fn _transfer(
        env: &Env,
        from: &Address,
        to: &Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        let mut token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        // Update balances
        Storage::decrement_balance(env, from);
        Storage::increment_balance(env, to);

        // Update token owner
        token.owner = to.clone();
        
        // Clear approval
        token.approved = None;
        Storage::remove_approval(env, token_id);

        // Save token
        Storage::set_token(env, token_id, &token);

        // Emit event
        Events::emit_transfer(env, from.clone(), to.clone(), token_id);

        Ok(())
    }

    /// Batch transfer multiple tokens
    pub fn batch_transfer(
        env: &Env,
        caller: &Address,
        from: &Address,
        to: &Address,
        token_ids: Vec<u64>,
    ) -> Result<(), ContractError> {
        if token_ids.len() == 0 {
            return Err(ContractError::InvalidInput);
        }

        // Validate addresses

        // Check contract is not paused
        AccessControl::require_not_paused(env)?;

        // Transfer each token
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            Self::transfer_from(env, caller, from, to, token_id)?;
        }

        Ok(())
    }

    /// Approve an address to transfer a specific token
    pub fn approve(
        env: &Env,
        caller: &Address,
        approved: &Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        let token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;

        // Caller must be owner or approved operator
        if token.owner != *caller {
            if !Storage::is_operator_approved(env, &token.owner, caller) {
                return Err(ContractError::NotOwner);
            }
        }

        // Cannot approve to current owner
        if *approved == token.owner {
            return Err(ContractError::ApprovalToCurrentOwner);
        }

        // Set approval
        Storage::set_approval(env, token_id, approved);
        
        let mut updated_token = token.clone();
        updated_token.approved = Some(approved.clone());
        Storage::set_token(env, token_id, &updated_token);

        // Emit event
        Events::emit_approval(env, token.owner, approved.clone(), token_id);

        Ok(())
    }

    /// Set approval for all tokens (operator approval)
    pub fn set_approval_for_all(
        env: &Env,
        caller: &Address,
        operator: &Address,
        approved: bool,
    ) -> Result<(), ContractError> {
        // Cannot approve self
        if *operator == *caller {
            return Err(ContractError::ApprovalToCaller);
        }

        // Set operator approval
        Storage::set_operator_approval(env, caller, operator, approved);

        // Emit event
        Events::emit_approval_for_all(env, caller.clone(), operator.clone(), approved);

        Ok(())
    }

    /// Get approved address for a token
    pub fn get_approved(env: &Env, token_id: u64) -> Result<Option<Address>, ContractError> {
        let _token = Storage::get_token(env, token_id)
            .ok_or(ContractError::TokenNotFound)?;
        
        Ok(Storage::get_approval(env, token_id))
    }

    /// Check if operator is approved for all tokens of owner
    pub fn is_approved_for_all(
        env: &Env,
        owner: &Address,
        operator: &Address,
    ) -> bool {
        Storage::is_operator_approved(env, owner, operator)
    }
}
