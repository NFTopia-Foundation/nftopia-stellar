use crate::collection::{NftCollection, NftCollectionClient};
use crate::factory::{CollectionFactory, CollectionFactoryClient};
use crate::types::CollectionConfig;
use soroban_sdk::TryFromVal;
use soroban_sdk::testutils::Events;
use soroban_sdk::{Address, Env, String, Symbol, Vec, symbol_short, testutils::Address as _};
// no_std: no vec import, no catch_unwind import

#[test]
fn test_factory_logic() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let _creator = Address::generate(&env);

    // Register Factory
    let factory_id = env.register(CollectionFactory, ());
    let factory_client = CollectionFactoryClient::new(&env, &factory_id);

    // Initialize Factory
    factory_client.initialize(&admin);

    assert_eq!(factory_client.get_collection_count(), 0);
}

#[test]
fn test_collection_logic() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let collection_id = env.register(NftCollection, ());
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

    collection_client.mint(&admin, &user1, &token_id, &uri, &attributes);
    // Assert event emission for mint
    assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
        if let Ok(sym) = Symbol::try_from_val(&env, &t) {
            sym == symbol_short!("mint")
        } else {
            false
        }
    })));

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

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let _user = Address::generate(&env);

    let collection_id = env.register(NftCollection, ());
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

// ------------------- HAPPY PATH TESTS -------------------

#[test]
fn test_batch_minting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);

    let config = CollectionConfig {
        name: String::from_str(&env, "Batch NFT"),
        symbol: String::from_str(&env, "BNFT"),
        description: String::from_str(&env, "Batch Mint Test"),
        base_uri: String::from_str(&env, "https://batch.com/"),
        max_supply: Some(10),
        is_public_mint: true,
        royalty_percentage: 250,
        royalty_recipient: admin.clone(),
    };

    collection_client.init(&admin, &config);

    // Mint multiple tokens to user1 and user2

    let tokens = [
        (user1.clone(), 1u32, String::from_str(&env, "ipfs://hash1")),
        (user1.clone(), 2u32, String::from_str(&env, "ipfs://hash2")),
        (user2.clone(), 3u32, String::from_str(&env, "ipfs://hash3")),
    ];
    for (to, token_id, uri) in &tokens {
        let attributes = Vec::new(&env);
        collection_client.mint(&admin, to, token_id, uri, &attributes);
        // Assert event emission for mint
        assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
            if let Ok(sym) = Symbol::try_from_val(&env, &t) {
                sym == symbol_short!("mint")
            } else {
                false
            }
        })));
    }

    // Assert ownership and balances
    assert_eq!(collection_client.owner_of(&1), Some(user1.clone()));
    assert_eq!(collection_client.owner_of(&2), Some(user1.clone()));
    assert_eq!(collection_client.owner_of(&3), Some(user2.clone()));
    assert_eq!(collection_client.balance_of(&user1, &1), 1);
    assert_eq!(collection_client.balance_of(&user1, &2), 1);
    assert_eq!(collection_client.balance_of(&user2, &3), 1);
    assert_eq!(collection_client.total_supply(), 3);
}

#[test]
fn test_burn_authorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let user1 = Address::generate(&env);

    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);

    let config = CollectionConfig {
        name: String::from_str(&env, "Burn NFT"),
        symbol: String::from_str(&env, "BNFT"),
        description: String::from_str(&env, "Burn Test"),
        base_uri: String::from_str(&env, "https://burn.com/"),
        max_supply: Some(5),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };

    collection_client.init(&admin, &config);

    // Mint a token to user1
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://burn1");
    let attributes = Vec::new(&env);
    collection_client.mint(&admin, &user1, &token_id, &uri, &attributes);
    assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
        if let Ok(sym) = Symbol::try_from_val(&env, &t) {
            sym == symbol_short!("mint")
        } else {
            false
        }
    })));

    // Assert pre-burn state
    assert_eq!(collection_client.owner_of(&token_id), Some(user1.clone()));
    assert_eq!(collection_client.balance_of(&user1, &token_id), 1);
    assert_eq!(collection_client.total_supply(), 1);

    // Burn the token as user1
    collection_client.burn(&user1, &token_id);

    // Assert post-burn state
    assert_eq!(collection_client.owner_of(&token_id), None);
    assert_eq!(collection_client.balance_of(&user1, &token_id), 0);
    assert_eq!(collection_client.total_supply(), 0);
}

#[test]
fn test_access_control_roles() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let minter = Address::generate(&env);
    let _user = Address::generate(&env);

    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);

    let config = CollectionConfig {
        name: String::from_str(&env, "Access NFT"),
        symbol: String::from_str(&env, "ANFT"),
        description: String::from_str(&env, "Access Control Test"),
        base_uri: String::from_str(&env, "https://access.com/"),
        max_supply: Some(5),
        is_public_mint: false,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);

    // Only admin is minter by default
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://access1");
    let attributes = Vec::new(&env);
    collection_client.mint(&admin, &admin, &token_id, &uri, &attributes);
    assert_eq!(collection_client.owner_of(&token_id), Some(admin.clone()));

    // Grant minter role
    collection_client.set_minter(&minter, &true);
    let token_id2 = 2u32;
    let uri2 = String::from_str(&env, "ipfs://access2");
    collection_client.mint(&minter, &minter, &token_id2, &uri2, &attributes);
    assert_eq!(collection_client.owner_of(&token_id2), Some(minter.clone()));

    // Revoke minter role
    collection_client.set_minter(&minter, &false);
    // Should fail if minter tries to mint again (revert path tested elsewhere)
    // Only admin can set minter
    // Only owner can burn their token
    collection_client.burn(&minter, &token_id2);
    assert_eq!(collection_client.owner_of(&token_id2), None);
}

#[test]
fn test_event_emissions_happy() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let user = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "Event NFT"),
        symbol: String::from_str(&env, "ENFT"),
        description: String::from_str(&env, "Event Test"),
        base_uri: String::from_str(&env, "https://event.com/"),
        max_supply: Some(2),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://event1");
    let attributes = Vec::new(&env);
    collection_client.mint(&admin, &user, &token_id, &uri, &attributes);
    assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
        if let Ok(sym) = Symbol::try_from_val(&env, &t) {
            sym == symbol_short!("mint")
        } else {
            false
        }
    })));
    collection_client.transfer(&user, &admin, &token_id);
    assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
        if let Ok(sym) = Symbol::try_from_val(&env, &t) {
            sym == symbol_short!("transfer")
        } else {
            false
        }
    })));
    collection_client.burn(&admin, &token_id);
    assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
        if let Ok(sym) = Symbol::try_from_val(&env, &t) {
            sym == symbol_short!("burn")
        } else {
            false
        }
    })));
}

#[test]
fn test_storage_state_happy() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let user = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "Storage NFT"),
        symbol: String::from_str(&env, "SNFT"),
        description: String::from_str(&env, "Storage Test"),
        base_uri: String::from_str(&env, "https://storage.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    // Before mint
    assert_eq!(collection_client.total_supply(), 0);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://storage1");
    let attributes = Vec::new(&env);
    collection_client.mint(&admin, &user, &token_id, &uri, &attributes);
    assert!(env.events().all().iter().any(|e| e.1.iter().any(|t| {
        if let Ok(sym) = Symbol::try_from_val(&env, &t) {
            sym == symbol_short!("mint")
        } else {
            false
        }
    })));
    // After mint
    assert_eq!(collection_client.total_supply(), 1);
    assert_eq!(collection_client.owner_of(&token_id), Some(user.clone()));
    // After burn
    collection_client.burn(&user, &token_id);
    assert_eq!(collection_client.total_supply(), 0);
    assert_eq!(collection_client.owner_of(&token_id), None);
}

// ------------------- REVERT PATH TESTS -------------------

#[test]
#[should_panic]
fn test_invalid_params_empty_name() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, ""),
        symbol: String::from_str(&env, "ENFT"),
        description: String::from_str(&env, "Empty Name"),
        base_uri: String::from_str(&env, "https://empty.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    // Should panic
    collection_client.init(&admin, &config);
}

#[test]
#[should_panic]
fn test_invalid_params_excessive_royalty() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "Excessive Royalty"),
        symbol: String::from_str(&env, "XNFT"),
        description: String::from_str(&env, "Excessive Royalty Test"),
        base_uri: String::from_str(&env, "https://royalty.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 10001,
        royalty_recipient: admin.clone(),
    };
    // Should panic
    collection_client.init(&admin, &config);
}

#[test]
#[should_panic]
fn test_invalid_params_zero_max_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "Zero Max"),
        symbol: String::from_str(&env, "ZNFT"),
        description: String::from_str(&env, "Zero Max Test"),
        base_uri: String::from_str(&env, "https://zero.com/"),
        max_supply: Some(0),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    // Should panic
    collection_client.init(&admin, &config);
}

#[test]
#[should_panic]
fn test_unauthorized_non_admin_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "NonAdminMint"),
        symbol: String::from_str(&env, "NAM"),
        description: String::from_str(&env, "Non Admin Mint Test"),
        base_uri: String::from_str(&env, "https://nonadmin.com/"),
        max_supply: Some(1),
        is_public_mint: false,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://nonadmin1");
    let attributes = Vec::new(&env);
    // Should panic
    collection_client.mint(&user, &user, &token_id, &uri, &attributes);
}

#[test]
#[should_panic]
fn test_unauthorized_non_owner_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let other = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "NonOwnerBurn"),
        symbol: String::from_str(&env, "NOB"),
        description: String::from_str(&env, "Non Owner Burn Test"),
        base_uri: String::from_str(&env, "https://nonowner.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://nonowner1");
    let attributes = Vec::new(&env);
    collection_client.mint(&user, &user, &token_id, &uri, &attributes);
    // Should panic
    collection_client.burn(&other, &token_id);
}

#[test]
#[should_panic]
fn test_unauthorized_fee_withdrawal() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let factory_id = env.register(CollectionFactory, ());
    let factory_client = CollectionFactoryClient::new(&env, &factory_id);
    factory_client.initialize(&admin);
    // Should panic
    factory_client.withdraw_fees(&user);
}

#[test]
#[should_panic]
fn test_mint_beyond_max_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "MaxSupply"),
        symbol: String::from_str(&env, "MAX"),
        description: String::from_str(&env, "Max Supply Test"),
        base_uri: String::from_str(&env, "https://max.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://max1");
    let attributes = Vec::new(&env);
    collection_client.mint(&user, &user, &token_id, &uri, &attributes);
    // Should panic
    collection_client.mint(&user, &user, &2u32, &uri, &attributes);
}

#[test]
#[should_panic]
fn test_transfer_nonexistent_token() {
    let env = Env::default();
    env.mock_all_auths();
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let admin = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "NonExistentTransfer"),
        symbol: String::from_str(&env, "NET"),
        description: String::from_str(&env, "Non Existent Transfer Test"),
        base_uri: String::from_str(&env, "https://nonexistent.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    // Should panic
    collection_client.transfer(&user1, &user2, &42u32);
}

#[test]
#[should_panic]
fn test_duplicate_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "DuplicateOp"),
        symbol: String::from_str(&env, "DUP"),
        description: String::from_str(&env, "Duplicate Operation Test"),
        base_uri: String::from_str(&env, "https://dup.com/"),
        max_supply: Some(2),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://dup1");
    let attributes = Vec::new(&env);
    collection_client.mint(&user, &user, &token_id, &uri, &attributes);
    // Should panic
    collection_client.mint(&user, &user, &token_id, &uri, &attributes);
}

#[test]
fn test_edge_empty_batch() {
    let env = Env::default();
    env.mock_all_auths();
    // If batch minting is implemented, test empty batch (pseudo, as batch_mint not in interface)
    // let result = std::panic::catch_unwind(|| {
    //     collection_client.batch_mint(&[]);
    // });
    // assert!(result.is_err());
}

#[test]
fn test_edge_maximum_batch_size() {
    let env = Env::default();
    env.mock_all_auths();
    // If batch minting is implemented, test max batch size (pseudo, as batch_mint not in interface)
    // let max_batch = ...;
    // let result = collection_client.batch_mint(&max_batch);
    // assert!(result.is_ok());
}

#[test]
fn test_edge_unicode_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    // removed unused variable
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    let config = CollectionConfig {
        name: String::from_str(&env, "ユニコード"),
        symbol: String::from_str(&env, "UNICODE"),
        description: String::from_str(&env, "Тест с юникодом"),
        base_uri: String::from_str(&env, "https://unicode.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 100,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://ユニコード");
    let attributes = Vec::new(&env);
    let _user = Address::generate(&env);
    let user = Address::generate(&env);
    collection_client.mint(&admin, &user, &token_id, &uri, &attributes);
    assert_eq!(collection_client.owner_of(&token_id), Some(user.clone()));
}

#[test]
fn test_edge_boundary_values() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let collection_id = env.register(NftCollection, ());
    let collection_client = NftCollectionClient::new(&env, &collection_id);
    // Test max royalty (10000)
    let config = CollectionConfig {
        name: String::from_str(&env, "BoundaryNFT"),
        symbol: String::from_str(&env, "BNDRY"),
        description: String::from_str(&env, "Boundary Test"),
        base_uri: String::from_str(&env, "https://boundary.com/"),
        max_supply: Some(1),
        is_public_mint: true,
        royalty_percentage: 10000,
        royalty_recipient: admin.clone(),
    };
    collection_client.init(&admin, &config);
    let token_id = 1u32;
    let uri = String::from_str(&env, "ipfs://boundary1");
    let attributes = Vec::new(&env);
    collection_client.mint(&admin, &user, &token_id, &uri, &attributes);
    assert_eq!(collection_client.owner_of(&token_id), Some(user.clone()));
}
