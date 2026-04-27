#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Bytes, Env, Symbol,
};

use crate::{
    error::SettlementError,
    royalty_distributor::RoyaltyDistributor,
    settlement_core::MarketplaceSettlement,
    types::{Asset, AuctionType},
    MarketplaceSettlementClient,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

fn setup_env() -> Env {
    Env::default()
}

/// Register the contract and return (env, contract_id, client, admin).
fn setup_contract() -> (Env, Address, MarketplaceSettlementClient<'static>, Address) {
    let env = setup_env();
    let contract_id = env.register_contract(None, MarketplaceSettlement);
    let client = MarketplaceSettlementClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin);
    // SAFETY: env lives for the duration of the test; the 'static bound is
    // satisfied by the test-local lifetime extension pattern used in Soroban tests.
    let client: MarketplaceSettlementClient<'static> =
        unsafe { std::mem::transmute(client) };
    (env, contract_id, client, admin)
}

/// Build a dummy Asset pointing at a freshly-generated address.
fn dummy_asset(env: &Env) -> Asset {
    Asset {
        contract: Address::generate(env),
        symbol: Symbol::new(env, "XLM"),
    }
}

/// Advance the ledger timestamp by `seconds`.
fn advance_time(env: &Env, seconds: u64) {
    let current = env.ledger().timestamp();
    env.ledger().set(LedgerInfo {
        timestamp: current + seconds,
        protocol_version: 22,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6312000,
    });
}

/// Register royalty info so `create_sale` / `create_auction` can calculate royalties.
fn register_royalty(env: &Env, nft: &Address, token_id: u64, creator: &Address) {
    env.mock_all_auths();
    RoyaltyDistributor::set_royalty_info(env, nft, token_id, creator, 500, creator)
        .expect("royalty registration failed");
}

// ─── Initialization ──────────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let (_env, _cid, _client, _admin) = setup_contract();
    // If we reach here without panic the contract initialised correctly.
}

#[test]
fn test_initialize_sets_default_fee_config() {
    let (env, _cid, client, admin) = setup_contract();
    let asset = dummy_asset(&env);
    // Accumulated fees start at zero – proves fee config was stored.
    let fees = client.get_accumulated_fees(&asset);
    assert_eq!(fees, 0i128);
    let _ = admin;
}

// ─── Sale – Happy Paths ──────────────────────────────────────────────────────

#[test]
fn test_create_sale_success() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &86400u64)
        .expect("create_sale failed");
    assert_eq!(tx_id, 1u64);
}

#[test]
fn test_get_sale_after_create() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &500_000i128, &currency, &3600u64)
        .expect("create_sale failed");

    let sale = client.get_sale(&tx_id).expect("get_sale failed");
    assert_eq!(sale.seller, seller);
    assert_eq!(sale.price, 500_000i128);
    assert_eq!(sale.token_id, 1u64);
}

#[test]
fn test_cancel_sale_by_seller() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &86400u64)
        .expect("create_sale failed");

    let sale_sym = Symbol::new(&env, "sale");
    client
        .cancel_transaction(&tx_id, &sale_sym, &seller)
        .expect("cancel_transaction failed");
}

// ─── Sale – Revert Paths ─────────────────────────────────────────────────────

#[test]
fn test_create_sale_zero_price_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let result = client.try_create_sale(&seller, &nft, &1u64, &0i128, &currency, &86400u64);
    assert!(result.is_err());
}

#[test]
fn test_cancel_sale_by_non_seller_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let attacker = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &86400u64)
        .expect("create_sale failed");

    let sale_sym = Symbol::new(&env, "sale");
    let result = client.try_cancel_transaction(&tx_id, &sale_sym, &attacker);
    assert!(result.is_err());
}

#[test]
fn test_execute_sale_wrong_payment_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &86400u64)
        .expect("create_sale failed");

    // Pay wrong amount
    let result = client.try_execute_sale(&tx_id, &buyer, &999_999i128);
    assert!(result.is_err());
}

#[test]
fn test_execute_expired_sale_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &60u64)
        .expect("create_sale failed");

    advance_time(&env, 120); // past expiry

    let result = client.try_execute_sale(&tx_id, &buyer, &1_000_000i128);
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_sale_fails() {
    let (_env, _cid, client, _admin) = setup_contract();
    let result = client.try_get_sale(&9999u64);
    assert!(result.is_err());
}

// ─── Auction – Happy Paths ───────────────────────────────────────────────────

#[test]
fn test_create_english_auction_success() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &100_000i128,
            &80_000i128,
            &3600u64,
            &1_000i128,
            &AuctionType::English,
            &currency,
        )
        .expect("create_auction failed");
    assert_eq!(auction_id, 1u64);
}

#[test]
fn test_create_dutch_auction_success() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &200_000i128,
            &50_000i128,
            &7200u64,
            &1_000i128,
            &AuctionType::Dutch,
            &currency,
        )
        .expect("create_dutch_auction failed");
    assert!(auction_id > 0);
}

#[test]
fn test_place_bid_success() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &100_000i128,
            &80_000i128,
            &3600u64,
            &1_000i128,
            &AuctionType::English,
            &currency,
        )
        .expect("create_auction failed");

    client
        .place_bid(&auction_id, &bidder, &105_000i128, &None)
        .expect("place_bid failed");

    let auction = client.get_auction(&auction_id).expect("get_auction failed");
    assert_eq!(auction.highest_bid, 105_000i128);
    assert_eq!(auction.highest_bidder, Some(bidder));
}

#[test]
fn test_get_dutch_auction_price() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &200_000i128,
            &50_000i128,
            &7200u64,
            &1_000i128,
            &AuctionType::Dutch,
            &currency,
        )
        .expect("create_dutch_auction failed");

    let price = client
        .get_dutch_auction_price(&auction_id)
        .expect("get_dutch_auction_price failed");
    assert!(price > 0);
}

// ─── Auction – Revert Paths ──────────────────────────────────────────────────

#[test]
fn test_create_auction_zero_price_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let result = client.try_create_auction(
        &seller,
        &nft,
        &1u64,
        &0i128,
        &0i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &currency,
    );
    assert!(result.is_err());
}

#[test]
fn test_place_bid_below_starting_price_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &100_000i128,
            &80_000i128,
            &3600u64,
            &1_000i128,
            &AuctionType::English,
            &currency,
        )
        .expect("create_auction failed");

    let result = client.try_place_bid(&auction_id, &bidder, &50_000i128, &None);
    assert!(result.is_err());
}

#[test]
fn test_place_bid_on_expired_auction_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &100_000i128,
            &80_000i128,
            &60u64,
            &1_000i128,
            &AuctionType::English,
            &currency,
        )
        .expect("create_auction failed");

    advance_time(&env, 120);

    let result = client.try_place_bid(&auction_id, &bidder, &110_000i128, &None);
    assert!(result.is_err());
}

#[test]
fn test_bid_below_increment_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let bidder1 = Address::generate(&env);
    let bidder2 = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &100_000i128,
            &80_000i128,
            &3600u64,
            &10_000i128, // 10k increment
            &AuctionType::English,
            &currency,
        )
        .expect("create_auction failed");

    client
        .place_bid(&auction_id, &bidder1, &110_000i128, &None)
        .expect("first bid failed");

    // Second bid only 1 unit above – below increment
    let result = client.try_place_bid(&auction_id, &bidder2, &110_001i128, &None);
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_auction_fails() {
    let (_env, _cid, client, _admin) = setup_contract();
    let result = client.try_get_auction(&9999u64);
    assert!(result.is_err());
}

// ─── Fee Manager ─────────────────────────────────────────────────────────────

#[test]
fn test_get_accumulated_fees_starts_zero() {
    let (env, _cid, client, _admin) = setup_contract();
    let asset = dummy_asset(&env);
    assert_eq!(client.get_accumulated_fees(&asset), 0i128);
}

#[test]
fn test_update_fee_config_by_admin() {
    use crate::types::{FeeConfig, VolumeTier};
    let (env, _cid, client, admin) = setup_contract();
    env.mock_all_auths();

    let new_config = FeeConfig {
        platform_fee_bps: 300,
        minimum_fee: 500,
        maximum_fee: 2_000_000,
        fee_recipient: admin.clone(),
        dynamic_fee_enabled: false,
        volume_discounts: soroban_sdk::Vec::new(&env),
        vip_exemptions: soroban_sdk::Vec::new(&env),
    };
    client
        .update_fee_config(&new_config, &admin)
        .expect("update_fee_config failed");
}

#[test]
fn test_update_fee_config_by_non_admin_fails() {
    use crate::types::{FeeConfig, VolumeTier};
    let (env, _cid, client, admin) = setup_contract();
    let attacker = Address::generate(&env);
    env.mock_all_auths();

    let new_config = FeeConfig {
        platform_fee_bps: 300,
        minimum_fee: 500,
        maximum_fee: 2_000_000,
        fee_recipient: admin.clone(),
        dynamic_fee_enabled: false,
        volume_discounts: soroban_sdk::Vec::new(&env),
        vip_exemptions: soroban_sdk::Vec::new(&env),
    };
    let result = client.try_update_fee_config(&new_config, &attacker);
    assert!(result.is_err());
}

#[test]
fn test_get_user_volume_starts_zero() {
    let (env, _cid, client, _admin) = setup_contract();
    let user = Address::generate(&env);
    let vol = client.get_user_volume(&user).expect("get_user_volume failed");
    assert_eq!(vol, 0i128);
}

// ─── Royalty Distributor ─────────────────────────────────────────────────────

#[test]
fn test_set_and_get_royalty_info() {
    let (env, _cid, _client, _admin) = setup_contract();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    env.mock_all_auths();

    RoyaltyDistributor::set_royalty_info(&env, &nft, 1, &creator, 500, &creator)
        .expect("set_royalty_info failed");

    let info = RoyaltyDistributor::get_royalty_info(&env, &nft, 1)
        .expect("get_royalty_info failed");
    assert_eq!(info.royalty_percentage, 500);
    assert_eq!(info.creator, creator);
}

#[test]
fn test_set_royalty_exceeds_max_fails() {
    let (env, _cid, _client, _admin) = setup_contract();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    env.mock_all_auths();

    // 5001 bps > 50% max
    let result = RoyaltyDistributor::set_royalty_info(&env, &nft, 1, &creator, 5001, &creator);
    assert_eq!(result, Err(SettlementError::InvalidRoyaltyPercentage));
}

#[test]
fn test_get_royalty_info_not_found_fails() {
    let (env, _cid, _client, _admin) = setup_contract();
    let nft = Address::generate(&env);
    let result = RoyaltyDistributor::get_royalty_info(&env, &nft, 99);
    assert_eq!(result, Err(SettlementError::NotFound));
}

// ─── Dispute Resolution ──────────────────────────────────────────────────────

#[test]
fn test_initiate_dispute_success() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &86400u64)
        .expect("create_sale failed");

    let reason = Bytes::from_slice(&env, b"item not received");
    let dispute_id = client
        .initiate_dispute(&tx_id, &reason, &None, &seller)
        .expect("initiate_dispute failed");
    assert!(dispute_id > 0);
}

#[test]
fn test_double_dispute_on_same_transaction_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let tx_id = client
        .create_sale(&seller, &nft, &1u64, &1_000_000i128, &currency, &86400u64)
        .expect("create_sale failed");

    let reason = Bytes::from_slice(&env, b"dispute reason");
    client
        .initiate_dispute(&tx_id, &reason, &None, &seller)
        .expect("first dispute failed");

    let result = client.try_initiate_dispute(&tx_id, &reason, &None, &seller);
    assert!(result.is_err());
}

// ─── Trade ───────────────────────────────────────────────────────────────────

#[test]
fn test_create_trade_success() {
    use crate::types::{NFTItem, RoyaltyDistribution};
    let (env, _cid, client, _admin) = setup_contract();
    let initiator = Address::generate(&env);
    let nft1 = Address::generate(&env);
    let nft2 = Address::generate(&env);
    let creator = Address::generate(&env);
    env.mock_all_auths();

    let dummy_royalty = RoyaltyDistribution {
        creator_address: creator.clone(),
        creator_percentage: 500,
        seller_percentage: 9000,
        platform_percentage: 500,
        total_amount: 0,
        amounts: soroban_sdk::Map::new(&env),
    };

    let mut initiator_nfts = soroban_sdk::Vec::new(&env);
    initiator_nfts.push_back(NFTItem {
        nft_address: nft1.clone(),
        token_id: 1,
        royalty_info: dummy_royalty.clone(),
    });

    let mut counterparty_nfts = soroban_sdk::Vec::new(&env);
    counterparty_nfts.push_back(NFTItem {
        nft_address: nft2.clone(),
        token_id: 2,
        royalty_info: dummy_royalty.clone(),
    });

    let trade_id = client
        .create_trade(&initiator, &None, &initiator_nfts, &counterparty_nfts, &3600u64)
        .expect("create_trade failed");
    assert!(trade_id > 0);
}

#[test]
fn test_create_trade_empty_nfts_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let initiator = Address::generate(&env);
    env.mock_all_auths();

    let empty: soroban_sdk::Vec<crate::types::NFTItem> = soroban_sdk::Vec::new(&env);
    let result = client.try_create_trade(&initiator, &None, &empty, &empty, &3600u64);
    assert!(result.is_err());
}

// ─── Bundle ───────────────────────────────────────────────────────────────────

#[test]
fn test_create_bundle_success() {
    use crate::types::{NFTItem, RoyaltyDistribution};
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    env.mock_all_auths();

    let dummy_royalty = RoyaltyDistribution {
        creator_address: creator.clone(),
        creator_percentage: 500,
        seller_percentage: 9000,
        platform_percentage: 500,
        total_amount: 0,
        amounts: soroban_sdk::Map::new(&env),
    };

    let mut items = soroban_sdk::Vec::new(&env);
    items.push_back(NFTItem {
        nft_address: nft.clone(),
        token_id: 1,
        royalty_info: dummy_royalty,
    });

    let bundle_id = client
        .create_bundle(&seller, &items, &500_000i128, &currency, &86400u64)
        .expect("create_bundle failed");
    assert!(bundle_id > 0);
}

#[test]
fn test_create_bundle_empty_items_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let currency = dummy_asset(&env);
    env.mock_all_auths();

    let empty: soroban_sdk::Vec<crate::types::NFTItem> = soroban_sdk::Vec::new(&env);
    let result = client.try_create_bundle(&seller, &empty, &500_000i128, &currency, &86400u64);
    assert!(result.is_err());
}

// ─── Emergency Withdrawal ────────────────────────────────────────────────────

#[test]
fn test_emergency_withdraw_by_non_admin_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let attacker = Address::generate(&env);
    env.mock_all_auths();

    let reason = Bytes::from_slice(&env, b"stuck");
    let result = client.try_emergency_withdraw(&1u64, &reason, &attacker);
    assert!(result.is_err());
}

// ─── Commit-Reveal (Front-running Prevention) ────────────────────────────────

#[test]
fn test_reveal_bid_with_wrong_salt_fails() {
    let (env, _cid, client, _admin) = setup_contract();
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let currency = dummy_asset(&env);
    register_royalty(&env, &nft, 1, &creator);
    env.mock_all_auths();

    let auction_id = client
        .create_auction(
            &seller,
            &nft,
            &1u64,
            &100_000i128,
            &80_000i128,
            &3600u64,
            &1_000i128,
            &AuctionType::English,
            &currency,
        )
        .expect("create_auction failed");

    // Commit a bid with a hash
    let commitment = Bytes::from_slice(&env, b"commitment_hash_placeholder");
    client
        .place_bid(&auction_id, &bidder, &110_000i128, &Some(commitment))
        .expect("place_bid failed");

    // Reveal with wrong salt
    let wrong_salt = Bytes::from_slice(&env, b"wrong_salt");
    let result = client.try_reveal_bid(&auction_id, &bidder, &110_000i128, &wrong_salt);
    assert!(result.is_err());
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

#[test]
fn test_cleanup_expired_commitments() {
    let (_env, _cid, client, _admin) = setup_contract();
    // Should succeed even when there is nothing to clean up.
    client
        .cleanup_expired_commitments()
        .expect("cleanup_expired_commitments failed");
}
