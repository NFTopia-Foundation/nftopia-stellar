#![cfg(test)]

use crate::types::{CollectionConfig, RoyaltyInfo, TokenAttribute};
use crate::{NftContract, NftContractClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env, String, Vec};

fn create_test_config(env: &Env, admin: &Address) -> CollectionConfig {
    CollectionConfig {
        name: String::from_str(env, "Test NFT"),
        symbol: String::from_str(env, "TNFT"),
        base_uri: String::from_str(env, "https://nftopia.test/"),
        max_supply: Some(1000),
        mint_price: None,
        is_revealed: true,
        royalty_default: RoyaltyInfo {
            recipient: admin.clone(),
            percentage: 500, // 5%
        },
        metadata_is_frozen: false,
    }
}

#[test]
fn test_initialize_and_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = create_test_config(&env, &admin);
    client.initialize(&admin, &config);

    client.set_minter(&admin, &admin, &true);

    let uri = String::from_str(&env, "ipfs://QmHash");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);
    let id = client.mint(&admin, &user, &uri, &attrs, &None);

    assert_eq!(id, 0);
    assert_eq!(client.owner_of(&id), user);
    assert_eq!(client.balance_of(&user), 1);
    assert_eq!(client.total_supply(), 1);
    assert_eq!(client.token_uri(&id), uri);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = create_test_config(&env, &admin);
    client.initialize(&admin, &config);
    client.set_minter(&admin, &admin, &true);

    let uri = String::from_str(&env, "ipfs://hash");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);
    let id = client.mint(&admin, &from, &uri, &attrs, &None);

    client.transfer(&from, &to, &id);

    assert_eq!(client.owner_of(&id), to);
    assert_eq!(client.balance_of(&from), 0);
    assert_eq!(client.balance_of(&to), 1);
}

#[test]
fn test_batch_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = create_test_config(&env, &admin);
    client.initialize(&admin, &config);
    client.set_minter(&admin, &admin, &true);

    let mut recipients: Vec<Address> = Vec::new(&env);
    recipients.push_back(user1.clone());
    recipients.push_back(user2.clone());

    let mut uris: Vec<String> = Vec::new(&env);
    uris.push_back(String::from_str(&env, "ipfs://1"));
    uris.push_back(String::from_str(&env, "ipfs://2"));

    let attrs1: Vec<TokenAttribute> = Vec::new(&env);
    let attrs2: Vec<TokenAttribute> = Vec::new(&env);
    let mut attrs: Vec<Vec<TokenAttribute>> = Vec::new(&env);
    attrs.push_back(attrs1);
    attrs.push_back(attrs2);

    let ids = client.batch_mint(&admin, &recipients, &uris, &attrs);
    assert_eq!(ids.len(), 2);
    let id0 = ids.get(0).unwrap();
    let id1 = ids.get(1).unwrap();
    assert_eq!(client.owner_of(&id0), user1);
    assert_eq!(client.owner_of(&id1), user2);
}

#[test]
fn test_royalty_info() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = create_test_config(&env, &admin);
    client.initialize(&admin, &config);
    client.set_minter(&admin, &admin, &true);

    let uri = String::from_str(&env, "ipfs://hash");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);
    let id = client.mint(&admin, &user, &uri, &attrs, &None);

    let (recipient, amount) = client.get_royalty_info(&id, &10000);
    assert_eq!(recipient, admin);
    assert_eq!(amount, 500); // 5% of 10000
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = create_test_config(&env, &admin);
    client.initialize(&admin, &config);
    client.set_minter(&admin, &admin, &true);

    let uri = String::from_str(&env, "ipfs://hash");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);
    let id = client.mint(&admin, &user, &uri, &attrs, &None);

    assert_eq!(client.balance_of(&user), 1);
    client.burn(&user, &id, &true);
    assert_eq!(client.balance_of(&user), 0);
}

#[test]
fn test_supports_interface() {
    let env = Env::default();
    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);
    assert!(client.supports_interface(&0x80ac58cd));
}

#[test]
fn test_edition_info() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = create_test_config(&env, &admin);
    client.initialize(&admin, &config);
    client.set_minter(&admin, &admin, &true);

    let uri = String::from_str(&env, "ipfs://hash");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);
    let id = client.mint(&admin, &user, &uri, &attrs, &None);

    let meta = client.token_metadata(&id);
    assert_eq!(meta.edition_number, None);
    assert_eq!(meta.total_editions, None);

    client.set_edition_info(&user, &id, &Some(1), &Some(10));
    let meta = client.token_metadata(&id);
    assert_eq!(meta.edition_number, Some(1));
    assert_eq!(meta.total_editions, Some(10));
}
