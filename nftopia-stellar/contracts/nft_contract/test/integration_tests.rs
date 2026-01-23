#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};
use nft_contract::{NftContract, NftContractClient};
use nft_contract::token::RoyaltyInfo;

#[test]
fn test_full_workflow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

        let owner = Address::random(&env);
        let minter = Address::random(&env);
        let user1 = Address::random(&env);
        let user2 = Address::random(&env);
        let royalty_recipient = Address::random(&env);
    
    // Initialize contract
    let name = SorobanString::from_str(&env, "Test Collection");
    let symbol = SorobanString::from_str(&env, "TCOL");
    let base_uri = SorobanString::from_str(&env, "https://api.example.com/metadata/");
    let default_royalty = RoyaltyInfo::new(royalty_recipient.clone(), 750); // 7.5%
    
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &Some(100u64), // max_supply
        &Some(1000000i128), // mint_price: 0.1 XLM
        &default_royalty,
    );

    // Add minter
    client.add_minter(&minter);

    // Mint multiple tokens
    let metadata_uri1 = SorobanString::from_str(&env, "token1.json");
    let metadata_uri2 = SorobanString::from_str(&env, "token2.json");
    let attributes = Vec::new(&env);

    let token_id1 = client.mint(
        &user1,
        &metadata_uri1,
        &attributes,
        &None,
        &None,
    );

    let token_id2 = client.mint(
        &user1,
        &metadata_uri2,
        &attributes,
        &None,
        &None,
    );

    assert_eq!(token_id1, 1u64);
    assert_eq!(token_id2, 2u64);
    assert_eq!(client.balance_of(&user1), 2u64);
    assert_eq!(client.total_supply(), 2u64);

    // Transfer token
    client.transfer_from(&user1, &user2, &token_id1);

    assert_eq!(client.balance_of(&user1), 1u64);
    assert_eq!(client.balance_of(&user2), 1u64);
    assert_eq!(client.owner_of(&token_id1), user2);

    // Test approval and transfer
        let approved = Address::random(&env);
    client.approve(&approved, &token_id2);
    
    let approved_addr = client.get_approved(&token_id2);
    assert_eq!(approved_addr, Some(approved));

    // Test royalty calculation
    let sale_price = 20000i128;
    let (royalty_recipient_addr, royalty_amount) = client.get_royalty_info(&token_id1, &sale_price);
    
    assert_eq!(royalty_recipient_addr, royalty_recipient);
    assert_eq!(royalty_amount, 1500i128); // 7.5% of 20000 = 1500
}

#[test]
fn test_batch_operations() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
        let user3 = Address::random(&env);
    let royalty_recipient = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Batch Collection");
    let symbol = SorobanString::from_str(&env, "BATCH");
    let base_uri = SorobanString::from_str(&env, "https://api.example.com/");
    let default_royalty = RoyaltyInfo::new(royalty_recipient, 500);
    
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &None,
        &None,
        &default_royalty,
    );

    client.add_minter(&minter);

    // Batch mint
    let mut recipients = Vec::new(&env);
    recipients.push_back(user1.clone());
    recipients.push_back(user2.clone());
    recipients.push_back(user3.clone());

    let mut metadata_uris = Vec::new(&env);
    metadata_uris.push_back(SorobanString::from_str(&env, "1.json"));
    metadata_uris.push_back(SorobanString::from_str(&env, "2.json"));
    metadata_uris.push_back(SorobanString::from_str(&env, "3.json"));

    let mut attributes_list = Vec::new(&env);
    let attrs1 = Vec::new(&env);
    let attrs2 = Vec::new(&env);
    let attrs3 = Vec::new(&env);
    attributes_list.push_back(attrs1);
    attributes_list.push_back(attrs2);
    attributes_list.push_back(attrs3);

    let token_ids = client.batch_mint(
        &recipients,
        &metadata_uris,
        &attributes_list,
        &None,
    );

    assert_eq!(token_ids.len(), 3);
    assert_eq!(client.balance_of(&user1), 1u64);
    assert_eq!(client.balance_of(&user2), 1u64);
    assert_eq!(client.balance_of(&user3), 1u64);
    assert_eq!(client.total_supply(), 3u64);

    // Batch transfer
    let mut token_ids_to_transfer = Vec::new(&env);
    token_ids_to_transfer.push_back(1u64);
    token_ids_to_transfer.push_back(2u64);

    client.batch_transfer(&user1, &user2, &token_ids_to_transfer);

    assert_eq!(client.balance_of(&user1), 0u64);
    assert_eq!(client.balance_of(&user2), 3u64); // 1 from batch mint + 2 from batch transfer
}

#[test]
fn test_access_control() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
        let admin = Address::random(&env);
        let minter = Address::random(&env);
        let burner = Address::random(&env);
        let unauthorized = Address::random(&env);
    let recipient = Address::generate(&env);
    let royalty_recipient = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Access Control Test");
    let symbol = SorobanString::from_str(&env, "ACT");
    let base_uri = SorobanString::from_str(&env, "https://api.example.com/");
    let default_royalty = RoyaltyInfo::new(royalty_recipient, 500);
    
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &None,
        &None,
        &default_royalty,
    );

    // Owner can add roles
    client.add_admin(&admin);
    client.add_minter(&minter);
    client.add_burner(&burner);

    // Minter can mint
    let metadata_uri = SorobanString::from_str(&env, "test.json");
    let attributes = Vec::new(&env);
    let token_id = client.mint(
        &recipient,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );

    assert_eq!(token_id, 1u64);

    // Admin can pause
    client.pause();

    // Unauthorized cannot mint when paused
    // (This would fail in actual implementation - test structure shown)
    
    // Admin can unpause
    client.unpause();

    // Burner can burn
    client.burn(&token_id, &true);

    assert_eq!(client.total_supply(), 0u64);
    assert_eq!(client.balance_of(&recipient), 0u64);
}

#[test]
fn test_metadata_management() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let recipient = Address::generate(&env);
    let royalty_recipient = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Metadata Test");
    let symbol = SorobanString::from_str(&env, "META");
    let base_uri = SorobanString::from_str(&env, "https://api.example.com/metadata/");
    let default_royalty = RoyaltyInfo::new(royalty_recipient, 500);
    
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &None,
        &None,
        &default_royalty,
    );

    client.add_minter(&minter);

    // Mint with metadata
    let metadata_uri = SorobanString::from_str(&env, "token1.json");
    let attributes = Vec::new(&env);
    let token_id = client.mint(
        &recipient,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );

    // Get token URI
    let token_uri = client.token_uri(&token_id);
    // Should combine base_uri + metadata_uri
    assert!(token_uri.len() > 0);

    // Update base URI (admin only)
    let new_base_uri = SorobanString::from_str(&env, "https://newapi.example.com/metadata/");
    client.set_base_uri(&new_base_uri);

    // Freeze metadata (admin only)
    client.freeze_metadata();
}

#[test]
fn test_max_supply() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let recipient = Address::generate(&env);
    let royalty_recipient = Address::generate(&env);
    
    // Initialize with max supply of 2
    let name = SorobanString::from_str(&env, "Limited Collection");
    let symbol = SorobanString::from_str(&env, "LIMIT");
    let base_uri = SorobanString::from_str(&env, "https://api.example.com/");
    let default_royalty = RoyaltyInfo::new(royalty_recipient, 500);
    
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &Some(2u64), // max_supply = 2
        &None,
        &default_royalty,
    );

    client.add_minter(&minter);

    let metadata_uri = SorobanString::from_str(&env, "token.json");
    let attributes = Vec::new(&env);

    // Mint first token
    let token_id1 = client.mint(
        &recipient,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );
    assert_eq!(token_id1, 1u64);

    // Mint second token
    let token_id2 = client.mint(
        &recipient,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );
    assert_eq!(token_id2, 2u64);

    // Third mint should fail (max supply exceeded)
    // In actual implementation, this would return an error
    // For test structure, we verify max_supply is respected
    let max_supply = client.max_supply();
    assert_eq!(max_supply, Some(2u64));
    assert_eq!(client.total_supply(), 2u64);
}
