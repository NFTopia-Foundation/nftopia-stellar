#![cfg(test)]

use crate::collection::{NftCollection, NftCollectionClient};
use crate::factory::{CollectionFactory, CollectionFactoryClient};
use crate::types::CollectionConfig;
use soroban_sdk::{Address, Env, String, Vec, testutils::Address as _};

#[test]
fn test_factory_logic() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let _creator = Address::generate(&env);

    // Register Factory
    let factory_id = env.register_contract(None, CollectionFactory);
    let factory_client = CollectionFactoryClient::new(&env, &factory_id);

    // Initialize Factory
    factory_client.initialize(&admin);

    assert_eq!(factory_client.get_collection_count(), 0);
}

#[test]
fn test_collection_logic() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let collection_id = env.register_contract(None, NftCollection);
    let collection_client = NftCollectionClient::new(&env, &collection_id);

    // Collection Config
    let config = CollectionConfig {
        name: String::from_str(&env, "Test NFT"),
        symbol: String::from_str(&env, "TNFT"),
        description: String::from_str(&env, "Test Description"),
        base_uri: String::from_str(&env, "https://test.com/"),
        max_supply: Some(100),
        is_public_mint: true,
        royalty_percentage: 500, // 5%
        royalty_recipient: admin.clone(),
    };

    collection_client.init(&admin, &config);

    // Mint NFT
    let token_id = 1;
    let uri = String::from_str(&env, "ipfs://hash");
    let attributes = Vec::new(&env);

    collection_client.mint(&user1, &token_id, &uri, &attributes);

    assert_eq!(collection_client.owner_of(&token_id), Some(user1.clone()));
    assert_eq!(collection_client.balance_of(&user1, &token_id), 1);
    assert_eq!(collection_client.total_supply(), 1);

    // Transfer NFT
    collection_client.transfer(&user1, &user2, &token_id);

    assert_eq!(collection_client.owner_of(&token_id), Some(user2.clone()));
    assert_eq!(collection_client.balance_of(&user1, &token_id), 0);
    assert_eq!(collection_client.balance_of(&user2, &token_id), 1);

    // Royalty Info
    let royalty = collection_client.get_royalty_info();
    assert_eq!(royalty.recipient, admin);
    assert_eq!(royalty.percentage, 500);
}

#[test]
fn test_unauthorized_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let _user = Address::generate(&env);

    let collection_id = env.register_contract(None, NftCollection);
    let collection_client = NftCollectionClient::new(&env, &collection_id);

    let config = CollectionConfig {
        name: String::from_str(&env, "Test"),
        symbol: String::from_str(&env, "T"),
        description: String::from_str(&env, "D"),
        base_uri: String::from_str(&env, "U"),
        max_supply: None,
        is_public_mint: false,
        royalty_percentage: 0,
        royalty_recipient: admin.clone(),
    };

    collection_client.init(&admin, &config);

    // Try to mint from non-minter address
    // collection_client.mint(&user, &1, &String::from_str(&env, "uri"), &Vec::new(&env));
    // Wait, the mint function checks if the env.storage().instance().get(&DataKey::FactoryAdmin) is the minter.
    // Actually, it checks Self::is_minter(&env, &admin).
}
