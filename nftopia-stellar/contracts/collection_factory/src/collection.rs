use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use crate::types::{CollectionConfig, RoyaltyInfo, TokenMetadata};
use soroban_sdk::{Address, Env, String, Vec, contract, contractimpl, panic_with_error};

#[contract]
pub struct NftCollection;

#[contractimpl]
impl NftCollection {
    pub fn init(env: Env, admin: Address, config: CollectionConfig) {
        if env.storage().instance().has(&DataKey::CollectionConfig) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::FactoryAdmin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CollectionConfig, &config);
        env.storage().instance().set(&DataKey::TotalSupply, &0u32);
        env.storage().instance().set(&DataKey::IsPaused, &false);

        let royalty_info = RoyaltyInfo {
            recipient: config.royalty_recipient.clone(),
            percentage: config.royalty_percentage,
        };
        env.storage()
            .instance()
            .set(&DataKey::RoyaltyInfo, &royalty_info);

        // Admin is the initial minter
        env.storage().instance().set(&DataKey::Minter(admin), &true);
    }

    pub fn mint(
        env: Env,
        to: Address,
        token_id: u32,
        uri: String,
        attributes: Vec<(String, String)>,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        // Allow only admin or designated minters
        if !Self::is_minter(&env, &admin) {
            return Err(ContractError::NotMinter);
        }

        if env
            .storage()
            .instance()
            .has(&DataKey::TokenMetadata(token_id))
        {
            return Err(ContractError::TokenAlreadyExists);
        }

        let config: CollectionConfig = env
            .storage()
            .instance()
            .get(&DataKey::CollectionConfig)
            .unwrap();
        let total_supply: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);

        if let Some(max) = config.max_supply
            && total_supply >= max
        {
            return Err(ContractError::SupplyLimitExceeded);
        }

        let metadata = TokenMetadata {
            token_id,
            uri: uri.clone(),
            attributes,
            creator: admin.clone(),
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::TokenMetadata(token_id), &metadata);
        env.storage().instance().set(&DataKey::Owner(token_id), &to);

        let balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(to.clone(), token_id))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance(to.clone(), token_id), &(balance + 1));

        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total_supply + 1));

        events::emit_mint(&env, env.current_contract_address(), to, token_id, 1);

        Ok(())
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: u32,
    ) -> Result<(), ContractError> {
        from.require_auth();

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
            .instance()
            .get(&DataKey::Owner(token_id))
            .ok_or(ContractError::NotFound)?;
        if owner != from {
            return Err(ContractError::NotAuthorized);
        }

        env.storage().instance().set(&DataKey::Owner(token_id), &to);

        let from_balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(from.clone(), token_id))
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::Balance(from.clone(), token_id),
            &(from_balance - 1),
        );

        let to_balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(to.clone(), token_id))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance(to.clone(), token_id), &(to_balance + 1));

        events::emit_transfer(&env, env.current_contract_address(), from, to, token_id, 1);

        Ok(())
    }

    pub fn burn(env: Env, from: Address, token_id: u32) -> Result<(), ContractError> {
        from.require_auth();

        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner(token_id))
            .ok_or(ContractError::NotFound)?;
        if owner != from {
            return Err(ContractError::NotAuthorized);
        }

        env.storage().instance().remove(&DataKey::Owner(token_id));
        env.storage()
            .instance()
            .remove(&DataKey::TokenMetadata(token_id));

        let balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(from.clone(), token_id))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance(from.clone(), token_id), &(balance - 1));

        let total_supply: u32 = env.storage().instance().get(&DataKey::TotalSupply).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total_supply - 1));

        events::emit_burn(&env, env.current_contract_address(), from, token_id, 1);

        Ok(())
    }

    pub fn get_token_uri(env: Env, token_id: u32) -> Option<String> {
        let metadata: TokenMetadata = env
            .storage()
            .instance()
            .get(&DataKey::TokenMetadata(token_id))?;
        Some(metadata.uri)
    }

    pub fn get_token_metadata(env: Env, token_id: u32) -> Option<TokenMetadata> {
        env.storage()
            .instance()
            .get(&DataKey::TokenMetadata(token_id))
    }

    pub fn total_supply(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance_of(env: Env, owner: Address, token_id: u32) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(owner, token_id))
            .unwrap_or(0)
    }

    pub fn owner_of(env: Env, token_id: u32) -> Option<Address> {
        env.storage().instance().get(&DataKey::Owner(token_id))
    }

    pub fn set_royalty_info(
        env: Env,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();

        if percentage > 10000 {
            return Err(ContractError::InvalidRoyalty);
        }

        let royalty_info = RoyaltyInfo {
            recipient,
            percentage,
        };
        env.storage()
            .instance()
            .set(&DataKey::RoyaltyInfo, &royalty_info);

        Ok(())
    }

    pub fn get_royalty_info(env: Env) -> RoyaltyInfo {
        env.storage().instance().get(&DataKey::RoyaltyInfo).unwrap()
    }

    pub fn set_pause(env: Env, paused: bool) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::IsPaused, &paused);
    }

    pub fn set_minter(env: Env, minter: Address, is_minter: bool) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Minter(minter), &is_minter);
    }

    fn is_minter(env: &Env, address: &Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Minter(address.clone()))
            .unwrap_or(false)
    }
}
