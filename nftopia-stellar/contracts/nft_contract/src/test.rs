use crate::types::{CollectionConfig, RoyaltyInfo, TokenAttribute};
use crate::{NftContract, NftContractClient};
use soroban_sdk::{Address, Env, String, Vec, testutils::Address as _};

fn make_config(env: &Env) -> CollectionConfig {
    CollectionConfig {
        name: String::from_str(env, "NFTopia"),
        symbol: String::from_str(env, "NFTP"),
        base_uri: String::from_str(env, ""),
        max_supply: Some(1000),
        mint_price: None,
        is_revealed: true,
        metadata_is_frozen: false,
    }
}

fn setup(env: &Env) -> (NftContractClient, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(env, &contract_id);
    let royalty = RoyaltyInfo {
        recipient: admin.clone(),
        percentage: 500,
    };
    client.initialize(&admin, &make_config(env), &Some(royalty));
    (client, admin)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    assert_eq!(client.total_supply(), 0);
    assert!(!client.is_paused());
    assert!(!client.is_metadata_frozen());
}

#[test]
fn test_mint_and_owner_of() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let uri = String::from_str(&env, "ipfs://QmTokenHash");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);

    let token_id = client.mint(&admin, &user, &uri, &attrs, &None);
    assert_eq!(token_id, 1);
    assert_eq!(client.owner_of(&token_id), user.clone());
    assert_eq!(client.balance_of(&user), 1);
    assert_eq!(client.total_supply(), 1);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let uri = String::from_str(&env, "ipfs://hash1");
    let attrs: Vec<TokenAttribute> = Vec::new(&env);

    let token_id = client.mint(&admin, &user1, &uri, &attrs, &None);
    client.transfer(&user1, &user1, &user2, &token_id);

    assert_eq!(client.owner_of(&token_id), user2.clone());
    assert_eq!(client.balance_of(&user1), 0);
    assert_eq!(client.balance_of(&user2), 1);
}

#[test]
fn test_approve_and_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let operator = Address::generate(&env);

    let token_id = client.mint(
        &admin,
        &user1,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    client.approve(&user1, &operator, &token_id);
    assert_eq!(client.get_approved(&token_id), Some(operator.clone()));

    client.transfer(&operator, &user1, &user2, &token_id);
    assert_eq!(client.owner_of(&token_id), user2.clone());
    // Approval should be cleared
    assert_eq!(client.get_approved(&token_id), None);
}

#[test]
fn test_set_approval_for_all() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user1 = Address::generate(&env);
    let operator = Address::generate(&env);

    let token_id = client.mint(
        &admin,
        &user1,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    client.set_approval_for_all(&user1, &operator, &true);
    assert!(client.is_approved_for_all(&user1, &operator));

    let user2 = Address::generate(&env);
    client.transfer(&operator, &user1, &user2, &token_id);
    assert_eq!(client.owner_of(&token_id), user2.clone());
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &user,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    client.burn(&user, &token_id);
    assert_eq!(client.total_supply(), 0);
    assert!(client.try_owner_of(&token_id).is_err());
}

#[test]
fn test_batch_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let mut recipients: Vec<Address> = Vec::new(&env);
    let mut uris: Vec<String> = Vec::new(&env);
    let mut all_attrs: Vec<Vec<TokenAttribute>> = Vec::new(&env);

    for _ in 0..3u32 {
        recipients.push_back(Address::generate(&env));
        uris.push_back(String::from_str(&env, "ipfs://batch"));
        all_attrs.push_back(Vec::new(&env));
    }

    let ids = client.batch_mint(&admin, &recipients, &uris, &all_attrs);
    assert_eq!(ids.len(), 3);
    assert_eq!(client.total_supply(), 3);
}

#[test]
fn test_batch_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let mut token_ids: Vec<u64> = Vec::new(&env);
    for _ in 0..3u32 {
        let id = client.mint(
            &admin,
            &user1,
            &String::from_str(&env, "ipfs://hash"),
            &Vec::new(&env),
            &None,
        );
        token_ids.push_back(id);
    }

    client.batch_transfer(&user1, &user1, &user2, &token_ids);
    assert_eq!(client.balance_of(&user1), 0);
    assert_eq!(client.balance_of(&user2), 3);
}

#[test]
fn test_royalty_info() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &user,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    let (recipient, amount) = client.get_royalty_info(&token_id, &10_000i128);
    assert_eq!(recipient, admin);
    assert_eq!(amount, 500i128); // 5% of 10_000
}

#[test]
fn test_freeze_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    client.freeze_metadata(&admin);
    assert!(client.is_metadata_frozen());

    // set_base_uri should fail after freeze
    let result = client.try_set_base_uri(&admin, &String::from_str(&env, "https://new.uri/"));
    assert!(result.is_err());
}

#[test]
fn test_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    client.set_pause(&admin, &true);
    assert!(client.is_paused());

    let user = Address::generate(&env);
    let result = client.try_mint(
        &admin,
        &user,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );
    assert!(result.is_err());
}

#[test]
fn test_supply_limit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &contract_id);

    let config = CollectionConfig {
        name: String::from_str(&env, "Limited"),
        symbol: String::from_str(&env, "LTD"),
        base_uri: String::from_str(&env, ""),
        max_supply: Some(2),
        mint_price: None,
        is_revealed: true,
        metadata_is_frozen: false,
    };
    client.initialize(&admin, &config, &None);

    let user = Address::generate(&env);
    client.mint(
        &admin,
        &user,
        &String::from_str(&env, "uri1"),
        &Vec::new(&env),
        &None,
    );
    client.mint(
        &admin,
        &user,
        &String::from_str(&env, "uri2"),
        &Vec::new(&env),
        &None,
    );

    let result = client.try_mint(
        &admin,
        &user,
        &String::from_str(&env, "uri3"),
        &Vec::new(&env),
        &None,
    );
    assert!(result.is_err());
}

#[test]
fn test_interface_support() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    assert!(client.supports_interface(&crate::interface::INTERFACE_NFT));
    assert!(client.supports_interface(&crate::interface::INTERFACE_ROYALTY));
    assert!(client.supports_interface(&crate::interface::INTERFACE_METADATA));
    assert!(client.supports_interface(&crate::interface::INTERFACE_BATCH));
    assert!(!client.supports_interface(&0xFF));
}

#[test]
fn test_rbac_grant_revoke() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let minter = Address::generate(&env);
    client.grant_role(&admin, &minter, &crate::types::role::MINTER);
    assert!(client.has_role(&minter, &crate::types::role::MINTER));

    client.revoke_role(&admin, &minter, &crate::types::role::MINTER);
    assert!(!client.has_role(&minter, &crate::types::role::MINTER));
}

#[test]
fn test_batch_too_large_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let mut recipients: Vec<Address> = Vec::new(&env);
    let mut uris: Vec<String> = Vec::new(&env);
    let mut all_attrs: Vec<Vec<TokenAttribute>> = Vec::new(&env);

    for _ in 0..51u32 {
        recipients.push_back(Address::generate(&env));
        uris.push_back(String::from_str(&env, "ipfs://hash"));
        all_attrs.push_back(Vec::new(&env));
    }

    let result = client.try_batch_mint(&admin, &recipients, &uris, &all_attrs);
    assert!(result.is_err());
}
