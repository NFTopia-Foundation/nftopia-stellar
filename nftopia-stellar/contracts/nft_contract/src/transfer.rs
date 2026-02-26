use crate::error::ContractError;
use crate::events::{emit_approval, emit_approval_for_all, emit_transfer};
use crate::storage::DataKey;
use crate::token::get_token;
use soroban_sdk::{Address, Env};

pub fn is_approved_or_owner(
    env: &Env,
    spender: &Address,
    token_id: u64,
) -> Result<bool, ContractError> {
    let token = get_token(env, token_id)?;
    if token.owner == *spender {
        return Ok(true);
    }
    if let Some(approved) = token.approved
        && approved == *spender {
            return Ok(true);
        }
    let is_operator = env
        .storage()
        .instance()
        .get(&DataKey::Operator(token.owner.clone(), spender.clone()))
        .unwrap_or(false);

    Ok(is_operator)
}

pub fn approve(
    env: &Env,
    spender: &Address,
    token_id: u64,
    sender: &Address,
) -> Result<(), ContractError> {
    sender.require_auth();
    let mut token = get_token(env, token_id)?;

    // Sender must be owner
    if token.owner != *sender {
        return Err(ContractError::NotOwner);
    }

    token.approved = Some(spender.clone());
    env.storage()
        .persistent()
        .set(&DataKey::Token(token_id), &token);

    emit_approval(env, sender, spender, token_id);
    Ok(())
}

pub fn set_approval_for_all(
    env: &Env,
    operator: &Address,
    approved: bool,
    sender: &Address,
) -> Result<(), ContractError> {
    sender.require_auth();
    env.storage().instance().set(
        &DataKey::Operator(sender.clone(), operator.clone()),
        &approved,
    );

    emit_approval_for_all(env, sender, operator, approved);
    Ok(())
}

pub fn transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    token_id: u64,
    sender: &Address,
) -> Result<(), ContractError> {
    sender.require_auth();

    if !is_approved_or_owner(env, sender, token_id)? {
        return Err(ContractError::NotAuthorized);
    }

    let mut token = get_token(env, token_id)?;
    if token.owner != *from {
        return Err(ContractError::NotOwner);
    }

    // Clear approvals
    token.approved = None;
    token.owner = to.clone();

    env.storage()
        .persistent()
        .set(&DataKey::Token(token_id), &token);

    // Update balances
    let mut from_balance: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(from.clone()))
        .unwrap_or(0);
    if from_balance > 0 {
        from_balance -= 1;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &from_balance);
    }

    let mut to_balance: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    to_balance += 1;
    env.storage()
        .persistent()
        .set(&DataKey::Balance(to.clone()), &to_balance);

    emit_transfer(env, from, to, token_id);

    Ok(())
}
