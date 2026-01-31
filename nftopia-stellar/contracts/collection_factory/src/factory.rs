use crate::error::ContractError;
use crate::events;
use crate::storage::DataKey;
use crate::types::{CollectionConfig, CollectionInfo};
use soroban_sdk::{Address, BytesN, Env, Val, Vec, contract, contractimpl, panic_with_error};

#[contract]
pub struct CollectionFactory;

#[contractimpl]
impl CollectionFactory {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::FactoryAdmin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::FactoryAdmin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CollectionCount, &0u32);
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
        // We use a cross-contract call to initialize
        // Since we don't have the client here easily without the trait, we use dynamic call
        env.invoke_contract::<()>(
            &collection_address,
            &soroban_sdk::symbol_short!("init"),
            soroban_sdk::vec![&env, admin.into_val(&env), config.clone().into_val(&env)],
        );

        let info = CollectionInfo {
            address: collection_address.clone(),
            creator: creator.clone(),
            config: config.clone(),
            created_at: env.ledger().timestamp(),
            total_tokens: 0,
        };

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

        events::emit_collection_created(&env, creator, collection_address.clone(), collection_id);

        Ok(collection_address)
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

    pub fn withdraw_fees(env: Env, _to: Address) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::FactoryAdmin)
            .unwrap();
        admin.require_auth();

        // Fee collection logic would go here
        // For now, we don't have native asset logic implemented here

        Ok(())
    }
}

// Helper trait to convert Address to Val
use soroban_sdk::IntoVal;
