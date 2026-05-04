use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use soroban_sdk::{Address, Env};

pub fn approve(
    env: &Env,
    owner: &Address,
    approved: &Address,
    token_id: u64,
) -> Result<(), ContractError> {
    let token_owner: Address = env
        .storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or(ContractError::TokenNotFound)?;

    if &token_owner != owner {
        return Err(ContractError::NotOwner);
    }

    env.storage()
        .persistent()
        .set(&DataKey::TokenApproved(token_id), approved);

    events::emit_approval(env, owner.clone(), approved.clone(), token_id);
    Ok(())
}

pub fn set_approval_for_all(env: &Env, owner: &Address, operator: &Address, approved: bool) {
    env.storage().persistent().set(
        &DataKey::OperatorApproval(owner.clone(), operator.clone()),
        &approved,
    );
    events::emit_approval_for_all(env, owner.clone(), operator.clone(), approved);
}

pub fn get_approved(env: &Env, token_id: u64) -> Option<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenApproved(token_id))
}

pub fn is_approved_for_all(env: &Env, owner: &Address, operator: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::OperatorApproval(owner.clone(), operator.clone()))
        .unwrap_or(false)
}

/// Returns true if `spender` is the owner, approved for the token, or an operator.
pub fn is_approved_or_owner(env: &Env, spender: &Address, token_id: u64) -> bool {
    let owner: Address = match env
        .storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
    {
        Some(o) => o,
        None => return false,
    };

    if spender == &owner {
        return true;
    }
    if let Some(approved) = env
        .storage()
        .persistent()
        .get::<_, Address>(&DataKey::TokenApproved(token_id))
        && spender == &approved
    {
        return true;
    }
    is_approved_for_all(env, &owner, spender)
}

pub fn do_transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    token_id: u64,
) -> Result<(), ContractError> {
    if env
        .storage()
        .instance()
        .get::<_, bool>(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(ContractError::ContractPaused);
    }

    let owner: Address = env
        .storage()
        .persistent()
        .get(&DataKey::TokenOwner(token_id))
        .ok_or(ContractError::TokenNotFound)?;

    if &owner != from {
        return Err(ContractError::NotOwner);
    }

    // Clear per-token approval on transfer
    env.storage()
        .persistent()
        .remove(&DataKey::TokenApproved(token_id));

    env.storage()
        .persistent()
        .set(&DataKey::TokenOwner(token_id), to);

    // Update balances
    let from_bal: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(from.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Balance(from.clone()), &from_bal.saturating_sub(1));

    let to_bal: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Balance(to.clone()), &(to_bal + 1));

    events::emit_transfer(env, from.clone(), to.clone(), token_id);
    Ok(())
}
