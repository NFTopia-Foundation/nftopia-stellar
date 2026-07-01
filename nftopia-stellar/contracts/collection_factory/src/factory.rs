use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use crate::types::{CollectionConfig, CollectionInfo};
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, Val, Vec, contract, contractimpl, panic_with_error, token,
};

#[contract]
pub struct CollectionFactory;

#[contractimpl]
impl CollectionFactory {
    pub fn initialize(env: Env, admin: Address, fee_asset: Address) {
        if env.storage().instance().has(&DataKey::FactoryAdmin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::FactoryAdmin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CollectionCount, &0u32);

        // Mainnet default limits: unverified default tier set to 10
        env.storage()
            .instance()
            .set(&DataKey::MaxCollectionsPerCreator, &10u32);

        // Fee configuration defaults: 0 means overflow system is disabled until configured
        env.storage().instance().set(&DataKey::FactoryFee, &0i128);
        env.storage().instance().set(&DataKey::FeeAsset, &fee_asset);
    }

    pub fn create_collection(
        env: Env,
        creator: Address,
        wasm_hash: BytesN<32>,
        salt: BytesN<32>,
        config: CollectionConfig,
    ) -> Result<Address, ContractError> {
        creator.require_auth();

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();

        // Check creator boundaries
        let current_creator_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CreatorCollectionCount(creator.clone()))
            .unwrap_or(0);

        let max_allowed: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxCollectionsPerCreator)
            .unwrap_or(10);

        if current_creator_count >= max_allowed {
            let fee_amount: i128 = env
                .storage()
                .instance()
                .get(&DataKey::FactoryFee)
                .unwrap_or(0);

            // If fee is zero or less, overflow tier is considered locked
            if fee_amount <= 0 {
                events::emit_creator_limit_exceeded_attempt(
                    &env,
                    creator.clone(),
                    current_creator_count,
                );
                return Err(ContractError::MaxCollectionsExceeded);
            }

            // Charge overflow fee to allow deployment
            let fee_asset: Address = env.storage().instance().get(&DataKey::FeeAsset).unwrap();
            let token_client = token::Client::new(&env, &fee_asset);

            // Transfer overflow fee from creator to factory instance
            token_client.transfer(&creator, env.current_contract_address(), &fee_amount);
        }

        let collection_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CollectionCount)
            .unwrap_or(0);

        let constructor_args: Vec<Val> = Vec::new(&env);

        // Deploy the collection contract
        let collection_address = env
            .deployer()
            .with_address(creator.clone(), salt)
            .deploy_v2(wasm_hash, constructor_args);

        // Initialize the collection
        env.invoke_contract::<()>(
            &collection_address,
            &soroban_sdk::symbol_short!("init"),
            soroban_sdk::vec![
                &env,
                admin.into_val(&env),
                env.current_contract_address().into_val(&env),
                config.clone().into_val(&env)
            ],
        );

        let info = CollectionInfo {
            address: collection_address.clone(),
            creator: creator.clone(),
            config: config.clone(),
            created_at: env.ledger().timestamp(),
            total_tokens: 0,
        };

        // Persist records
        env.storage().instance().set(
            &DataKey::CollectionAddress(collection_id),
            &collection_address,
        );
        env.storage()
            .instance()
            .set(&DataKey::CollectionInfo(collection_id), &info);
        env.storage()
            .instance()
            .set(&DataKey::CollectionCount, &(collection_id + 1));

        // Increment unique creator address metrics
        env.storage().instance().set(
            &DataKey::CreatorCollectionCount(creator.clone()),
            &(current_creator_count + 1),
        );

        events::emit_collection_created(&env, creator, collection_address.clone(), collection_id);
        events::emit_collection_registered(
            &env,
            env.current_contract_address(),
            collection_address.clone(),
        );

        Ok(collection_address)
    }

    pub fn verify_factory_origin(env: Env, collection: Address) -> bool {
        // Check if the collection was deployed by this factory
        // by calling is_from_factory on the collection
        let result: bool = env.invoke_contract::<bool>(
            &collection,
            &soroban_sdk::symbol_short!("is_fact"),
            soroban_sdk::vec![&env, env.current_contract_address().into_val(&env)],
        );
        result
    }

    pub fn get_collections_by_factory(env: Env) -> Vec<Address> {
        let count = env
            .storage()
            .instance()
            .get(&DataKey::CollectionCount)
            .unwrap_or(0);
        let mut collections = Vec::new(&env);

        for i in 0..count {
            if let Some(address) = env.storage().instance().get(&DataKey::CollectionAddress(i)) {
                collections.push_back(address);
            }
        }

        collections
    }

    /* Operational Admin Functions */

    pub fn update_creator_limit(env: Env, new_limit: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();

        let old_limit: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxCollectionsPerCreator)
            .unwrap_or(10);

        env.storage()
            .instance()
            .set(&DataKey::MaxCollectionsPerCreator, &new_limit);

        events::emit_max_collections_updated(&env, old_limit, new_limit);
    }

    pub fn set_overflow_fee(env: Env, fee_amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::FactoryFee, &fee_amount);
    }

    pub fn reset_creator_collection_count(env: Env, creator: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::CreatorCollectionCount(creator.clone()), &0u32);

        events::emit_collection_count_reset(&env, creator);
    }

    /* Getter Views */

    pub fn get_max_collections(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MaxCollectionsPerCreator)
            .unwrap_or(10)
    }

    pub fn get_creator_collection_count(env: Env, creator: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CreatorCollectionCount(creator))
            .unwrap_or(0)
    }

    pub fn get_remaining_count(env: Env, creator: Address) -> u32 {
        let max_allowed: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxCollectionsPerCreator)
            .unwrap_or(10);
        let current_count = env
            .storage()
            .instance()
            .get(&DataKey::CreatorCollectionCount(creator))
            .unwrap_or(0);

        max_allowed.saturating_sub(current_count)
    }

    pub fn get_collection_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CollectionCount)
            .unwrap_or(0)
    }

    pub fn get_collection_address(env: Env, id: u32) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::CollectionAddress(id))
    }

    pub fn get_collection_info(env: Env, id: u32) -> Option<CollectionInfo> {
        env.storage().instance().get(&DataKey::CollectionInfo(id))
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::FactoryAdmin, &new_admin);
    }

    pub fn withdraw_fees(env: Env, to: Address) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        // Only admin can withdraw
        if !to.eq(&admin) {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }
        admin.require_auth();

        let fee_asset: Address = env.storage().instance().get(&DataKey::FeeAsset).unwrap();
        let token_client = token::Client::new(&env, &fee_asset);
        let balance = token_client.balance(&env.current_contract_address());

        if balance > 0 {
            token_client.transfer(&env.current_contract_address(), &to, &balance);
        }

        Ok(())
    }
}
