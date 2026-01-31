use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::reentrancy;
use crate::storage::DataKey;
use soroban_sdk::{Address, Bytes, Env, Vec};

/// Validates that `from` (the one who authed) can transfer: must be owner, approved, or operator.
fn require_can_transfer(env: &Env, from: &Address, token_id: u64) -> Result<(), ContractError> {
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    if owner == *from {
        return Ok(());
    }
    let approved: Option<Address> = env.storage().instance().get(&DataKey::Approved(token_id));
    if let Some(a) = approved {
        if a == *from {
            return Ok(());
        }
    }
    let is_operator: bool = env
        .storage()
        .instance()
        .get(&DataKey::OperatorApproval(owner.clone(), from.clone()))
        .unwrap_or(false);
    if is_operator {
        return Ok(());
    }
    Err(ContractError::NotApproved)
}

/// Internal transfer implementation (no auth check - caller must have verified).
fn do_transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    token_id: u64,
) -> Result<(), ContractError> {
    access_control::require_not_paused(env)?;

    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::Owner(token_id))
        .ok_or(ContractError::TokenNotFound)?;
    if owner != *from {
        return Err(ContractError::NotAuthorized);
    }
    if from == to {
        return Ok(());
    }

    env.storage().instance().set(&DataKey::Owner(token_id), to);
    env.storage()
        .instance()
        .remove(&DataKey::Approved(token_id));

    let from_balance: u64 = env
        .storage()
        .instance()
        .get(&DataKey::Balance(from.clone()))
        .unwrap_or(0);
    env.storage().instance().set(
        &DataKey::Balance(from.clone()),
        &from_balance.saturating_sub(1),
    );

    let to_balance: u64 = env
        .storage()
        .instance()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    env.storage()
        .instance()
        .set(&DataKey::Balance(to.clone()), &to_balance.saturating_add(1));

    events::emit_transfer(env, from.clone(), to.clone(), token_id);
    Ok(())
}

/// Transfers token from one address to another. Caller must be owner, approved, or operator.
pub fn transfer(env: &Env, from: Address, to: Address, token_id: u64) -> Result<(), ContractError> {
    from.require_auth();
    reentrancy::acquire(env)?;
    let result = (|| {
        require_can_transfer(env, &from, token_id)?;
        do_transfer(env, &from, &to, token_id)
    })();
    reentrancy::release(env);
    result
}

/// Transfers token; if `to` is a contract, invokes nft_recv for validation.
/// Reverts (transfers back) if the receiver contract rejects. Caller must be owner, approved, or operator.
pub fn safe_transfer_from(
    env: &Env,
    from: Address,
    to: Address,
    token_id: u64,
    data: Option<Bytes>,
) -> Result<(), ContractError> {
    from.require_auth();
    reentrancy::acquire(env)?;
    let result = (|| -> Result<(), ContractError> {
        require_can_transfer(env, &from, token_id)?;
        do_transfer(env, &from, &to, token_id)?;

        // Notify receiver contract if different from self (ERC-721 receiver callback).
        if to != env.current_contract_address() {
            use soroban_sdk::IntoVal;
            let invoke_result = env.try_invoke_contract::<(), ContractError>(
                &to,
                &soroban_sdk::symbol_short!("nft_recv"),
                soroban_sdk::vec![
                    &env,
                    from.clone().into_val(env),
                    token_id.into_val(env),
                    data.into_val(env),
                ],
            );
            if let Ok(Err(_)) = invoke_result {
                // Revert: transfer back to from.
                let _ = do_transfer(env, &to, &from, token_id);
                return Err(ContractError::TransferRejected);
            }
        }
        Ok(())
    })();
    reentrancy::release(env);
    result
}

/// Batch transfer: transfers multiple tokens from one address to another.
pub fn batch_transfer(
    env: &Env,
    from: Address,
    to: Address,
    token_ids: Vec<u64>,
) -> Result<(), ContractError> {
    from.require_auth();
    reentrancy::acquire(env)?;
    let result = (|| {
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            require_can_transfer(env, &from, token_id)?;
        }
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            do_transfer(env, &from, &to, token_id)?;
        }
        Ok(())
    })();
    reentrancy::release(env);
    result
}
