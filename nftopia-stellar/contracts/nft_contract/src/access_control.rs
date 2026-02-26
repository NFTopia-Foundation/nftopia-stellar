use crate::error::ContractError;
use crate::storage::DataKey;
use crate::types::Role;
use soroban_sdk::{Address, Env};

// In a real contract, we might want to store roles differently (e.g., mapping of (Address, Role) -> bool).
// For simplicity and common standard, we typically store the admin in DataKey::Admin.
// We also track Minters, Burners, and MetadataUpdaters.

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn set_admin(env: &Env, new_admin: &Address) {
    if let Some(admin) = get_admin(env)
        && admin != *new_admin {
            // Usually we require current admin auth
            admin.require_auth();
        }
    env.storage().instance().set(&DataKey::Admin, new_admin);
}

pub fn require_admin(env: &Env) -> Result<(), ContractError> {
    if let Some(admin) = get_admin(env) {
        admin.require_auth();
        Ok(())
    } else {
        Err(ContractError::NotAuthorized)
    }
}

pub fn grant_role(env: &Env, role: Role, address: &Address) -> Result<(), ContractError> {
    require_admin(env)?;

    let key = match role {
        Role::Minter => DataKey::Minter(address.clone()),
        Role::Burner => DataKey::Burner(address.clone()),
        Role::MetadataUpdater => DataKey::MetadataUpdater(address.clone()),
        Role::Admin | Role::Owner => {
            return Err(ContractError::NotPermitted); // Admin is set via set_admin
        }
    };

    env.storage().instance().set(&key, &true);
    Ok(())
}

pub fn revoke_role(env: &Env, role: Role, address: &Address) -> Result<(), ContractError> {
    require_admin(env)?;

    let key = match role {
        Role::Minter => DataKey::Minter(address.clone()),
        Role::Burner => DataKey::Burner(address.clone()),
        Role::MetadataUpdater => DataKey::MetadataUpdater(address.clone()),
        Role::Admin | Role::Owner => {
            return Err(ContractError::NotPermitted);
        }
    };

    env.storage().instance().remove(&key);
    Ok(())
}

pub fn has_role(env: &Env, role: Role, address: &Address) -> bool {
    // Admin inherently has all operator roles, or we can check exact match
    if let Some(admin) = get_admin(env)
        && admin == *address {
            return true;
        }

    let key = match role {
        Role::Minter => DataKey::Minter(address.clone()),
        Role::Burner => DataKey::Burner(address.clone()),
        Role::MetadataUpdater => DataKey::MetadataUpdater(address.clone()),
        _ => return false,
    };

    env.storage().instance().get(&key).unwrap_or(false)
}

pub fn require_role(env: &Env, role: Role, address: &Address) -> Result<(), ContractError> {
    if has_role(env, role, address) {
        address.require_auth();
        Ok(())
    } else {
        Err(ContractError::NotAuthorized)
    }
}
