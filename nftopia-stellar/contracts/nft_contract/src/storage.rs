use soroban_sdk::{contracttype, Address, String as SorobanString, Map, Vec, Env};
use crate::token::{TokenData, RoyaltyInfo, TokenAttribute};
use crate::error::ContractError;

/// Collection configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectionConfig {
    pub name: SorobanString,
    pub symbol: SorobanString,
    pub base_uri: SorobanString,
    pub max_supply: Option<u64>,
    pub mint_price: Option<i128>, // Optional mint cost in stroops
    pub is_revealed: bool,
    pub royalty_default: RoyaltyInfo,
    pub metadata_is_frozen: bool,
    pub is_paused: bool,
}

impl CollectionConfig {
    pub fn new(
        name: SorobanString,
        symbol: SorobanString,
        base_uri: SorobanString,
        max_supply: Option<u64>,
        mint_price: Option<i128>,
        royalty_default: RoyaltyInfo,
    ) -> Self {
        Self {
            name,
            symbol,
            base_uri,
            max_supply,
            mint_price,
            is_revealed: false,
            royalty_default,
            metadata_is_frozen: false,
            is_paused: false,
        }
    }
}

/// Storage keys for persistent data
#[contracttype]
pub enum DataKey {
    // Collection configuration
    Config,
    
    // Token data: Map<u64, TokenData>
    Token(u64),
    
    // Owner balances: Map<Address, u64>
    Balance(Address),
    
    // Token approvals: Map<u64, Address>
    Approval(u64),
    
    // Operator approvals: Map<(Address, Address), bool>
    OperatorApproval(Address, Address),
    
    // Total supply counter
    TotalSupply,
    
    // Owner address
    Owner,
    
    // Admin addresses: Vec<Address>
    Admins,
    
    // Minter addresses: Vec<Address>
    Minters,
    
    // Burner addresses: Vec<Address>
    Burners,
    
    // Metadata updaters: Vec<Address>
    MetadataUpdaters,
    
    // Initialized flag
    Initialized,
    
    // Invoker address (temporary storage for current call)
    Invoker,
}

pub struct Storage;

impl Storage {
    // Collection configuration
    pub fn get_config(env: &Env) -> Option<CollectionConfig> {
        env.storage().persistent().get(&DataKey::Config)
    }

    pub fn set_config(env: &Env, config: &CollectionConfig) {
        env.storage().persistent().set(&DataKey::Config, config);
    }

    // Token data
    pub fn get_token(env: &Env, token_id: u64) -> Option<TokenData> {
        env.storage().persistent().get(&DataKey::Token(token_id))
    }

    pub fn set_token(env: &Env, token_id: u64, token: &TokenData) {
        env.storage().persistent().set(&DataKey::Token(token_id), token);
    }

    pub fn remove_token(env: &Env, token_id: u64) {
        env.storage().persistent().remove(&DataKey::Token(token_id));
    }

    // Owner balances
    pub fn get_balance(env: &Env, owner: &Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner.clone()))
            .unwrap_or(0)
    }

    pub fn set_balance(env: &Env, owner: &Address, balance: u64) {
        if balance == 0 {
            env.storage().persistent().remove(&DataKey::Balance(owner.clone()));
        } else {
            env.storage().persistent().set(&DataKey::Balance(owner.clone()), &balance);
        }
    }

    pub fn increment_balance(env: &Env, owner: &Address) {
        let current = Self::get_balance(env, owner);
        Self::set_balance(env, owner, current + 1);
    }

    pub fn decrement_balance(env: &Env, owner: &Address) {
        let current = Self::get_balance(env, owner);
        if current > 0 {
            Self::set_balance(env, owner, current - 1);
        }
    }

    // Token approvals
    pub fn get_approval(env: &Env, token_id: u64) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Approval(token_id))
    }

    pub fn set_approval(env: &Env, token_id: u64, approved: &Address) {
        env.storage().persistent().set(&DataKey::Approval(token_id), approved);
    }

    pub fn remove_approval(env: &Env, token_id: u64) {
        env.storage().persistent().remove(&DataKey::Approval(token_id));
    }

    // Operator approvals
    pub fn is_operator_approved(env: &Env, owner: &Address, operator: &Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::OperatorApproval(owner.clone(), operator.clone()))
            .unwrap_or(false)
    }

    pub fn set_operator_approval(env: &Env, owner: &Address, operator: &Address, approved: bool) {
        if approved {
            env.storage()
                .persistent()
                .set(&DataKey::OperatorApproval(owner.clone(), operator.clone()), &true);
        } else {
            env.storage()
                .persistent()
                .remove(&DataKey::OperatorApproval(owner.clone(), operator.clone()));
        }
    }

    // Total supply
    pub fn get_total_supply(env: &Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn set_total_supply(env: &Env, supply: u64) {
        env.storage().persistent().set(&DataKey::TotalSupply, &supply);
    }

    pub fn increment_total_supply(env: &Env) -> u64 {
        let current = Self::get_total_supply(env);
        let new_supply = current + 1;
        Self::set_total_supply(env, new_supply);
        new_supply
    }

    pub fn decrement_total_supply(env: &Env) {
        let current = Self::get_total_supply(env);
        if current > 0 {
            Self::set_total_supply(env, current - 1);
        }
    }

    // Owner
    pub fn get_owner(env: &Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Owner)
    }

    pub fn set_owner(env: &Env, owner: &Address) {
        env.storage().persistent().set(&DataKey::Owner, owner);
    }

    // Role management - Admins
    pub fn get_admins(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Admins)
            .unwrap_or(Vec::new(env))
    }

    pub fn set_admins(env: &Env, admins: &Vec<Address>) {
        env.storage().persistent().set(&DataKey::Admins, admins);
    }

    pub fn is_admin(env: &Env, address: &Address) -> bool {
        let admins = Self::get_admins(env);
        admins.contains(address)
    }

    pub fn add_admin(env: &Env, admin: &Address) {
        let admins = Self::get_admins(env);
        if !admins.contains(admin) {
            let mut new_admins = admins.clone();
            new_admins.push_back(admin.clone());
            Self::set_admins(env, &new_admins);
        }
    }

    pub fn remove_admin(env: &Env, admin: &Address) {
        let admins = Self::get_admins(env);
        let mut new_admins = Vec::new(env);
        for i in 0..admins.len() {
            let addr = admins.get(i).unwrap();
            if addr != *admin {
                new_admins.push_back(addr);
            }
        }
        Self::set_admins(env, &new_admins);
    }

    // Role management - Minters
    pub fn get_minters(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Minters)
            .unwrap_or(Vec::new(env))
    }

    pub fn set_minters(env: &Env, minters: &Vec<Address>) {
        env.storage().persistent().set(&DataKey::Minters, minters);
    }

    pub fn is_minter(env: &Env, address: &Address) -> bool {
        let minters = Self::get_minters(env);
        minters.contains(address) || Self::is_admin(env, address) || Self::is_owner(env, address)
    }

    pub fn add_minter(env: &Env, minter: &Address) {
        let minters = Self::get_minters(env);
        if !minters.contains(minter) {
            let mut new_minters = minters.clone();
            new_minters.push_back(minter.clone());
            Self::set_minters(env, &new_minters);
        }
    }

    pub fn remove_minter(env: &Env, minter: &Address) {
        let minters = Self::get_minters(env);
        let mut new_minters = Vec::new(env);
        for i in 0..minters.len() {
            let addr = minters.get(i).unwrap();
            if addr != *minter {
                new_minters.push_back(addr);
            }
        }
        Self::set_minters(env, &new_minters);
    }

    // Role management - Burners
    pub fn get_burners(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Burners)
            .unwrap_or(Vec::new(env))
    }

    pub fn is_burner(env: &Env, address: &Address) -> bool {
        let burners = Self::get_burners(env);
        burners.contains(address) || Self::is_admin(env, address) || Self::is_owner(env, address)
    }

    pub fn add_burner(env: &Env, burner: &Address) {
        let mut burners = Self::get_burners(env);
        if !burners.contains(burner) {
            burners.push_back(burner.clone());
            env.storage().persistent().set(&DataKey::Burners, &burners);
        }
    }

    // Role management - Metadata Updaters
    pub fn get_metadata_updaters(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::MetadataUpdaters)
            .unwrap_or(Vec::new(env))
    }

    pub fn is_metadata_updater(env: &Env, address: &Address) -> bool {
        let updaters = Self::get_metadata_updaters(env);
        updaters.contains(address) || Self::is_admin(env, address) || Self::is_owner(env, address)
    }

    // Owner check
    pub fn is_owner(env: &Env, address: &Address) -> bool {
        Self::get_owner(env)
            .map(|owner| owner == *address)
            .unwrap_or(false)
    }

    // Initialized flag
    pub fn is_initialized(env: &Env) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Initialized)
            .unwrap_or(false)
    }

    pub fn set_initialized(env: &Env) {
        env.storage().persistent().set(&DataKey::Initialized, &true);
    }
}
