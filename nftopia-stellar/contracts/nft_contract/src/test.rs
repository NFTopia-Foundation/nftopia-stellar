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

fn setup(env: &Env) -> (NftContractClient<'_>, Address) {
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

// ─── set_token_uri auth (Issue #245) ─────────────────────────────────────────

#[test]
fn test_set_token_uri_by_owner_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://original"),
        &Vec::new(&env),
        &None,
    );

    client.set_token_uri(&owner, &token_id, &String::from_str(&env, "ipfs://updated"));
    assert_eq!(
        client.token_uri(&token_id),
        String::from_str(&env, "ipfs://updated")
    );
}

#[test]
fn test_set_token_uri_by_non_owner_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let non_owner = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://original"),
        &Vec::new(&env),
        &None,
    );

    let result = client.try_set_token_uri(
        &non_owner,
        &token_id,
        &String::from_str(&env, "ipfs://hacked"),
    );
    assert!(result.is_err());
}

#[test]
fn test_set_token_uri_admin_role_alone_fails() {
    // Contract-level ADMIN must NOT grant per-token metadata write access
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://original"),
        &Vec::new(&env),
        &None,
    );

    // admin has OWNER+ADMIN roles but is not the token owner
    let result = client.try_set_token_uri(
        &admin,
        &token_id,
        &String::from_str(&env, "ipfs://admin-override"),
    );
    assert!(result.is_err());
}

#[test]
fn test_set_token_uri_metadata_updater_role_fails_without_ownership() {
    // METADATA_UPDATER role alone (without token ownership) must be rejected
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let updater = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://original"),
        &Vec::new(&env),
        &None,
    );

    // Grant METADATA_UPDATER to updater (contract-global role)
    client.grant_role(&admin, &updater, &crate::types::role::METADATA_UPDATER);

    // updater is not the token owner — must be rejected
    let result = client.try_set_token_uri(
        &updater,
        &token_id,
        &String::from_str(&env, "ipfs://updater-override"),
    );
    assert!(result.is_err());
}

#[test]
fn test_burn_by_owner_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    // Owner burns their own token
    client.burn(&owner, &token_id);
    assert_eq!(client.total_supply(), 0);
    assert!(client.try_owner_of(&token_id).is_err());
}

#[test]
fn test_burn_by_burner_role_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let burner = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    // Grant BURNER role to burner
    client.grant_role(&admin, &burner, &crate::types::role::BURNER);
    assert!(client.has_role(&burner, &crate::types::role::BURNER));

    // Burner burns token
    client.burn(&burner, &token_id);
    assert_eq!(client.total_supply(), 0);
    assert!(client.try_owner_of(&token_id).is_err());
}

#[test]
fn test_burn_by_unauthorized_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    // Unauthorized user tries to burn
    let result = client.try_burn(&unauthorized, &token_id);
    assert!(result.is_err());
    // Token should still exist
    assert_eq!(client.owner_of(&token_id), owner);
    assert_eq!(client.total_supply(), 1);
}

#[test]
fn test_burn_non_existent_token_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let owner = Address::generate(&env);
    let non_existent_id = 999u64;

    let result = client.try_burn(&owner, &non_existent_id);
    assert!(result.is_err());
}

#[test]
fn test_burn_already_burned_token_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    // Burn once
    client.burn(&owner, &token_id);
    assert_eq!(client.total_supply(), 0);

    // Try to burn again
    let result = client.try_burn(&owner, &token_id);
    assert!(result.is_err());
}

#[test]
fn test_burn_cleans_up_approvals() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let operator = Address::generate(&env);
    let token_id = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    // Approve operator
    client.approve(&owner, &operator, &token_id);
    assert_eq!(client.get_approved(&token_id), Some(operator.clone()));

    // Burn token
    client.burn(&owner, &token_id);

    // Approval should be cleared
    assert_eq!(client.get_approved(&token_id), None);
}

#[test]
fn test_batch_burn_by_owner_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let mut token_ids: Vec<u64> = Vec::new(&env);

    for _ in 0..3u32 {
        let id = client.mint(
            &admin,
            &owner,
            &String::from_str(&env, "ipfs://hash"),
            &Vec::new(&env),
            &None,
        );
        token_ids.push_back(id);
    }

    assert_eq!(client.total_supply(), 3);
    assert_eq!(client.balance_of(&owner), 3);

    // Batch burn all tokens
    client.batch_burn(&owner, &token_ids);
    assert_eq!(client.total_supply(), 0);
    assert_eq!(client.balance_of(&owner), 0);
}

#[test]
fn test_batch_burn_by_burner_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let burner = Address::generate(&env);

    let mut token_ids: Vec<u64> = Vec::new(&env);

    // Mint tokens to different owners
    let id1 = client.mint(
        &admin,
        &owner1,
        &String::from_str(&env, "ipfs://hash1"),
        &Vec::new(&env),
        &None,
    );
    token_ids.push_back(id1);

    let id2 = client.mint(
        &admin,
        &owner2,
        &String::from_str(&env, "ipfs://hash2"),
        &Vec::new(&env),
        &None,
    );
    token_ids.push_back(id2);

    // Grant BURNER role
    client.grant_role(&admin, &burner, &crate::types::role::BURNER);

    assert_eq!(client.total_supply(), 2);

    // Burner burns tokens from different owners
    client.batch_burn(&burner, &token_ids);
    assert_eq!(client.total_supply(), 0);
    assert_eq!(client.balance_of(&owner1), 0);
    assert_eq!(client.balance_of(&owner2), 0);
}

#[test]
fn test_batch_burn_with_mixed_ownership_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let non_owner = Address::generate(&env);

    let mut token_ids: Vec<u64> = Vec::new(&env);

    let id1 = client.mint(
        &admin,
        &owner1,
        &String::from_str(&env, "ipfs://hash1"),
        &Vec::new(&env),
        &None,
    );
    token_ids.push_back(id1);

    let id2 = client.mint(
        &admin,
        &owner2,
        &String::from_str(&env, "ipfs://hash2"),
        &Vec::new(&env),
        &None,
    );
    token_ids.push_back(id2);

    // Non-owner tries to batch burn tokens they don't own
    let result = client.try_batch_burn(&non_owner, &token_ids);
    assert!(result.is_err());

    // Tokens should still exist
    assert_eq!(client.total_supply(), 2);
    assert_eq!(client.owner_of(&id1), owner1);
    assert_eq!(client.owner_of(&id2), owner2);
}

#[test]
fn test_batch_burn_too_large_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let mut token_ids: Vec<u64> = Vec::new(&env);

    for _ in 0..51u32 {
        let id = client.mint(
            &admin,
            &owner,
            &String::from_str(&env, "ipfs://hash"),
            &Vec::new(&env),
            &None,
        );
        token_ids.push_back(id);
    }

    let result = client.try_batch_burn(&owner, &token_ids);
    assert!(result.is_err());
}

#[test]
fn test_batch_burn_with_non_existent_token_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let mut token_ids: Vec<u64> = Vec::new(&env);

    let id1 = client.mint(
        &admin,
        &owner,
        &String::from_str(&env, "ipfs://hash1"),
        &Vec::new(&env),
        &None,
    );
    token_ids.push_back(id1);
    token_ids.push_back(999u64); // Non-existent token

    let result = client.try_batch_burn(&owner, &token_ids);
    assert!(result.is_err());

    // First token should still exist (atomicity)
    assert_eq!(client.total_supply(), 1);
    assert_eq!(client.owner_of(&id1), owner);
}
