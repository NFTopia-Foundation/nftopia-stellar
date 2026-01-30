use crate::error::ContractError;
use crate::storage::DataKey;
use soroban_sdk::Address;
use soroban_sdk::Env;

/// Requires that the contract is not paused.
pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);
    if paused {
        return Err(ContractError::ContractPaused);
    }
    Ok(())
}

/// Requires that the caller is the contract owner.
pub fn require_owner(env: &Env) -> Result<Address, ContractError> {
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::OwnerRole)
        .ok_or(ContractError::NotFound)?;
    owner.require_auth();
    Ok(owner)
}

/// Requires that the caller has admin role.
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
    caller.require_auth();
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::OwnerRole)
        .ok_or(ContractError::NotFound)?;
    if *caller == owner {
        return Ok(());
    }
    let is_admin: bool = env
        .storage()
        .instance()
        .get(&DataKey::Admin(caller.clone()))
        .unwrap_or(false);
    if is_admin {
        Ok(())
    } else {
        Err(ContractError::MissingRole)
    }
}

/// Requires that the caller has minter role.
pub fn require_minter(env: &Env, caller: &Address) -> Result<(), ContractError> {
    caller.require_auth();
    if has_role(env, caller, crate::types::Role::Owner)
        || has_role(env, caller, crate::types::Role::Admin)
        || env
            .storage()
            .instance()
            .get(&DataKey::Minter(caller.clone()))
            .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(ContractError::MissingRole)
    }
}

/// Requires that the caller has burner role.
pub fn require_burner(env: &Env, caller: &Address) -> Result<(), ContractError> {
    caller.require_auth();
    if has_role(env, caller, crate::types::Role::Owner)
        || has_role(env, caller, crate::types::Role::Admin)
        || env
            .storage()
            .instance()
            .get(&DataKey::Burner(caller.clone()))
            .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(ContractError::MissingRole)
    }
}

/// Requires that the caller has metadata updater role (or owner/admin).
pub fn require_metadata_updater(env: &Env, caller: &Address) -> Result<(), ContractError> {
    caller.require_auth();
    if has_role(env, caller, crate::types::Role::Owner)
        || has_role(env, caller, crate::types::Role::Admin)
        || env
            .storage()
            .instance()
            .get(&DataKey::MetadataUpdater(caller.clone()))
            .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(ContractError::MissingRole)
    }
}

fn has_role(env: &Env, address: &Address, role: crate::types::Role) -> bool {
    match role {
        crate::types::Role::Owner => {
            let owner: Option<Address> = env.storage().instance().get(&DataKey::OwnerRole);
            owner.map(|o| *address == o).unwrap_or(false)
        }
        crate::types::Role::Admin => env
            .storage()
            .instance()
            .get(&DataKey::Admin(address.clone()))
            .unwrap_or(false),
        crate::types::Role::Minter => env
            .storage()
            .instance()
            .get(&DataKey::Minter(address.clone()))
            .unwrap_or(false),
        crate::types::Role::Burner => env
            .storage()
            .instance()
            .get(&DataKey::Burner(address.clone()))
            .unwrap_or(false),
        crate::types::Role::MetadataUpdater => env
            .storage()
            .instance()
            .get(&DataKey::MetadataUpdater(address.clone()))
            .unwrap_or(false),
    }
}

/// Requires that the caller is whitelisted (when whitelist is enforced).
pub fn require_whitelisted(env: &Env, address: &Address) -> Result<(), ContractError> {
    let owner: Address = env
        .storage()
        .instance()
        .get(&DataKey::OwnerRole)
        .ok_or(ContractError::NotFound)?;
    if *address == owner {
        return Ok(());
    }
    let is_whitelisted: bool = env
        .storage()
        .instance()
        .get(&DataKey::Whitelist(address.clone()))
        .unwrap_or(false);
    if is_whitelisted {
        Ok(())
    } else {
        Err(ContractError::NotWhitelisted)
    }
}
