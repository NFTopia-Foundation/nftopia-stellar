#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};
use nft_contract::{NftContract, NftContractClient};
use nft_contract::token::RoyaltyInfo;

#[test]
fn test_royalty_calculation() {
    let env = Env::default();
    let recipient = Address::generate(&env);
    let royalty_info = RoyaltyInfo::new(recipient.clone(), 500); // 5%

    // Test 5% royalty on 1000 stroops
    let sale_price = 1000i128;
    let royalty = royalty_info.calculate_royalty(sale_price).unwrap();
    assert_eq!(royalty, 50); // 5% of 1000 = 50

    // Test 10% royalty on 10000 stroops
    let royalty_info_10 = RoyaltyInfo::new(recipient.clone(), 1000); // 10%
    let royalty_10 = royalty_info_10.calculate_royalty(10000i128).unwrap();
    assert_eq!(royalty_10, 1000); // 10% of 10000 = 1000

    // Test 0% royalty
    let royalty_info_0 = RoyaltyInfo::new(recipient, 0);
    let royalty_0 = royalty_info_0.calculate_royalty(1000i128).unwrap();
    assert_eq!(royalty_0, 0);
}

#[test]
fn test_royalty_validation() {
    let env = Env::default();
    let recipient = Address::generate(&env);

    // Valid royalty (5%)
    let valid = RoyaltyInfo::new(recipient.clone(), 500);
    assert!(valid.validate());

    // Valid royalty (100%)
    let valid_100 = RoyaltyInfo::new(recipient.clone(), 10000);
    assert!(valid_100.validate());

    // Invalid royalty (>100%)
    let invalid = RoyaltyInfo::new(recipient, 10001);
    assert!(!invalid.validate());
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let name = SorobanString::from_str(&env, "Test NFT");
    let symbol = SorobanString::from_str(&env, "TNFT");
    let base_uri = SorobanString::from_str(&env, "https://example.com/");
    let default_royalty = RoyaltyInfo::new(Address::generate(&env), 500); // 5%

    // Initialize the contract
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &Some(1000u64), // max_supply
        &None,           // mint_price
        &default_royalty,
    );

    // Verify initialization
    let contract_name = client.name();
    assert_eq!(contract_name, name);
    
    let contract_symbol = client.symbol();
    assert_eq!(contract_symbol, symbol);
}

#[test]
fn test_mint() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let recipient = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Test NFT");
    let symbol = SorobanString::from_str(&env, "TNFT");
    let base_uri = SorobanString::from_str(&env, "https://example.com/");
    let default_royalty = RoyaltyInfo::new(Address::generate(&env), 500);
    
    client.initialize(
        &owner,
        &name,
        &symbol,
        &base_uri,
        &None,
        &None,
        &default_royalty,
    );

    // Add minter role
    client.add_minter(&minter);

    // Mint token
    let metadata_uri = SorobanString::from_str(&env, "ipfs://QmTest123");
    let attributes = Vec::new(&env);
    let token_id = client.mint(
        &recipient,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );

    assert_eq!(token_id, 1u64);

    // Verify ownership
    let token_owner = client.owner_of(&token_id);
    assert_eq!(token_owner, recipient);

    // Verify balance
    let balance = client.balance_of(&recipient);
    assert_eq!(balance, 1u64);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Test NFT");
    let symbol = SorobanString::from_str(&env, "TNFT");
    let base_uri = SorobanString::from_str(&env, "https://example.com/");
    let default_royalty = RoyaltyInfo::new(Address::generate(&env), 500);
    
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

    // Mint token
    let metadata_uri = SorobanString::from_str(&env, "ipfs://QmTest123");
    let attributes = Vec::new(&env);
    let token_id = client.mint(
        &from,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );

    // Transfer token
    client.transfer_from(&from, &to, &token_id);

    // Verify new ownership
    let token_owner = client.owner_of(&token_id);
    assert_eq!(token_owner, to);

    // Verify balances
    let from_balance = client.balance_of(&from);
    let to_balance = client.balance_of(&to);
    assert_eq!(from_balance, 0u64);
    assert_eq!(to_balance, 1u64);
}

#[test]
fn test_approval() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let token_owner = Address::generate(&env);
    let approved = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Test NFT");
    let symbol = SorobanString::from_str(&env, "TNFT");
    let base_uri = SorobanString::from_str(&env, "https://example.com/");
    let default_royalty = RoyaltyInfo::new(Address::generate(&env), 500);
    
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

    // Mint token
    let metadata_uri = SorobanString::from_str(&env, "ipfs://QmTest123");
    let attributes = Vec::new(&env);
    let token_id = client.mint(
        &token_owner,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );

    // Approve address
    client.approve(&approved, &token_id);

    // Verify approval
    let approved_addr = client.get_approved(&token_id);
    assert_eq!(approved_addr, Some(approved));
}

#[test]
fn test_royalty_info() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let recipient = Address::generate(&env);
    let royalty_recipient = Address::generate(&env);
    
    // Initialize
    let name = SorobanString::from_str(&env, "Test NFT");
    let symbol = SorobanString::from_str(&env, "TNFT");
    let base_uri = SorobanString::from_str(&env, "https://example.com/");
    let default_royalty = RoyaltyInfo::new(royalty_recipient.clone(), 500);
    
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

    // Mint token
    let metadata_uri = SorobanString::from_str(&env, "ipfs://QmTest123");
    let attributes = Vec::new(&env);
    let token_id = client.mint(
        &recipient,
        &metadata_uri,
        &attributes,
        &None,
        &None,
    );

    // Get royalty info
    let sale_price = 10000i128;
    let (royalty_recipient_addr, royalty_amount) = client.get_royalty_info(&token_id, &sale_price);
    
    assert_eq!(royalty_recipient_addr, royalty_recipient);
    assert_eq!(royalty_amount, 500i128); // 5% of 10000 = 500
}
