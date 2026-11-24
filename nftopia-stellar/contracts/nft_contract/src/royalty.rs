use crate::access_control;
use crate::error::ContractError;
use crate::events;
use crate::storage::{DataKey, MAX_ROYALTY_BPS};
use crate::types::{RoyaltyInfo, TokenData, role};
use soroban_sdk::{Address, Env};

/// Shared cap check (#735) so `set_default_royalty`, `set_token_royalty`,
/// and `validate_royalty_override` all enforce the same limit from one
/// place.
fn validate_royalty_percentage(percentage: u32) -> Result<(), ContractError> {
    if percentage > MAX_ROYALTY_BPS {
        return Err(ContractError::InvalidRoyalty);
    }
    Ok(())
}

pub fn set_default_royalty(
    env: &Env,
    caller: &Address,
    recipient: Address,
    percentage: u32,
) -> Result<(), ContractError> {
    access_control::require_admin_or_owner(env, caller);
    validate_royalty_percentage(percentage)?;
    let info = RoyaltyInfo {
        recipient: recipient.clone(),
        percentage,
    };
    env.storage()
        .instance()
        .set(&DataKey::DefaultRoyalty, &info);
    events::emit_royalty_update(env, recipient, percentage);
    Ok(())
}

pub fn set_token_royalty(
    env: &Env,
    caller: &Address,
    token_id: u64,
    recipient: Address,
    percentage: u32,
) -> Result<(), ContractError> {
    access_control::require_admin_or_owner(env, caller);
    validate_royalty_percentage(percentage)?;
    let info = RoyaltyInfo {
        recipient,
        percentage,
    };
    env.storage()
        .persistent()
        .set(&DataKey::TokenRoyalty(token_id), &info);
    Ok(())
}

/// Validates a `royalty_override` passed to `mint`/`batch_mint` (#735).
///
/// `None` (fall back to `DefaultRoyalty`) is always fine — there is
/// nothing to validate. A `Some` override must respect the platform cap
/// regardless of caller. Redirecting the royalty *recipient* away from
/// `DefaultRoyalty`'s own recipient is restricted to contract admin/owner:
/// a plain MINTER may tune the percentage per token (e.g. a promotional
/// 0% drop) but may not redirect who gets paid, since that would let any
/// minter-role account route a token's perpetual royalty to themselves.
/// With no `DefaultRoyalty` configured at all, there is nothing to
/// diverge from, so any recipient is accepted from any minter.
pub fn validate_royalty_override(
    env: &Env,
    caller: &Address,
    override_royalty: &Option<RoyaltyInfo>,
) -> Result<(), ContractError> {
    let Some(royalty) = override_royalty else {
        return Ok(());
    };

    validate_royalty_percentage(royalty.percentage)?;

    let default_recipient: Option<Address> = env
        .storage()
        .instance()
        .get::<_, RoyaltyInfo>(&DataKey::DefaultRoyalty)
        .map(|info| info.recipient);

    let recipient_diverges = default_recipient
        .as_ref()
        .is_some_and(|recipient| recipient != &royalty.recipient);

    if recipient_diverges
        && !access_control::has_role(env, caller, role::OWNER)
        && !access_control::has_role(env, caller, role::ADMIN)
    {
        return Err(ContractError::NotAuthorized);
    }

    Ok(())
}

/// EIP-2981 equivalent: returns (recipient, royalty_amount) for a given sale price.
///
/// Priority order (#735 follow-up): an explicit post-mint `set_token_royalty`
/// override (`TokenRoyalty(token_id)`) wins if present; otherwise the
/// royalty is read from the token's own `TokenData` — the recipient/
/// percentage resolved and snapshotted at mint time (either the mint's own
/// `royalty_override` or `DefaultRoyalty` as it stood then). Falling back
/// straight to the *current* `DefaultRoyalty` without checking `TokenData`
/// first was a bug: it meant a mint-time `royalty_override` was silently
/// ignored by every caller of this function, and a later
/// `set_default_royalty` call would retroactively change the royalty terms
/// of every already-minted token that never asked for an override.
pub fn get_royalty_info(
    env: &Env,
    token_id: u64,
    sale_price: i128,
) -> Result<(Address, i128), ContractError> {
    let info: RoyaltyInfo = env
        .storage()
        .persistent()
        .get(&DataKey::TokenRoyalty(token_id))
        .or_else(|| {
            env.storage()
                .persistent()
                .get::<_, TokenData>(&DataKey::TokenData(token_id))
                .map(|data| RoyaltyInfo {
                    recipient: data.royalty_recipient,
                    percentage: data.royalty_percentage,
                })
        })
        .or_else(|| env.storage().instance().get(&DataKey::DefaultRoyalty))
        .ok_or(ContractError::NotFound)?;

    let royalty_amount = sale_price
        .checked_mul(info.percentage as i128)
        .and_then(|v| v.checked_div(MAX_ROYALTY_BPS as i128))
        .ok_or(ContractError::ArithmeticError)?;

    Ok((info.recipient, royalty_amount))
}
