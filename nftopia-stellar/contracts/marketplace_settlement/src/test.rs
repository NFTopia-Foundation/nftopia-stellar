#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Bytes, Env, Symbol};

use crate::{
    error::SettlementError,
    royalty_distributor::RoyaltyDistributor,
    settlement_core::{MarketplaceSettlement, MarketplaceSettlementClient},
    types::{Asset, AuctionType},
};

fn mk_asset(env: &Env) -> Asset {
    Asset {
        contract: Address::generate(env),
        symbol: Symbol::new(env, "XLM"),
    }
}

fn new_env() -> (Env, Address, MarketplaceSettlementClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let cid = env.register(MarketplaceSettlement, ());
    let client = MarketplaceSettlementClient::new(&env, &cid);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let client: MarketplaceSettlementClient<'static> = unsafe { core::mem::transmute(client) };
    (env, cid, client)
}

fn reg(env: &Env, cid: &Address, nft: &Address, creator: &Address) {
    env.as_contract(cid, || {
        let _ = RoyaltyDistributor::set_royalty_info(env, nft, 1, creator, 500, creator);
    });
}

// ─── Init ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    new_env();
}

#[test]
fn test_accumulated_fees_start_zero() {
    let (env, _cid, client) = new_env();
    assert_eq!(client.get_accumulated_fees(&mk_asset(&env)), 0i128);
}

// ─── Sale ────────────────────────────────────────────────────────────────────

#[test]
fn test_create_sale_success() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_sale(
        &seller,
        &nft,
        &1u64,
        &1_000_000i128,
        &mk_asset(&env),
        &86400u64,
    );
    assert_eq!(id, 1u64);
}

#[test]
fn test_get_sale_after_create() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let cur = mk_asset(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_sale(&seller, &nft, &1u64, &500_000i128, &cur, &3600u64);
    let sale = client.get_sale(&id);
    assert_eq!(sale.seller, seller);
    assert_eq!(sale.price, 500_000i128);
}

#[test]
fn test_cancel_sale_by_seller() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_sale(
        &seller,
        &nft,
        &1u64,
        &1_000_000i128,
        &mk_asset(&env),
        &86400u64,
    );
    client.cancel_transaction(&id, &Symbol::new(&env, "sale"), &seller);
}

#[test]
fn test_cancel_sale_non_seller_fails() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let attacker = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_sale(
        &seller,
        &nft,
        &1u64,
        &1_000_000i128,
        &mk_asset(&env),
        &86400u64,
    );
    assert!(client
        .try_cancel_transaction(&id, &Symbol::new(&env, "sale"), &attacker)
        .is_err());
}

#[test]
fn test_execute_sale_wrong_payment_fails() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_sale(
        &seller,
        &nft,
        &1u64,
        &1_000_000i128,
        &mk_asset(&env),
        &86400u64,
    );
    assert!(client.try_execute_sale(&id, &buyer, &999_999i128).is_err());
}

#[test]
fn test_get_nonexistent_sale_fails() {
    let (_env, _cid, client) = new_env();
    assert!(client.try_get_sale(&9999u64).is_err());
}

// ─── Auction ─────────────────────────────────────────────────────────────────

#[test]
fn test_create_english_auction_success() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &mk_asset(&env),
    );
    assert_eq!(id, 1u64);
}

#[test]
fn test_create_dutch_auction_success() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &200_000i128,
        &50_000i128,
        &7200u64,
        &1_000i128,
        &AuctionType::Dutch,
        &mk_asset(&env),
    );
    assert!(id > 0);
}

#[test]
fn test_create_auction_zero_price_fails() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    assert!(client
        .try_create_auction(
            &seller,
            &nft,
            &1u64,
            &0i128,
            &0i128,
            &3600u64,
            &1_000i128,
            &AuctionType::English,
            &mk_asset(&env),
        )
        .is_err());
}

#[test]
fn test_bid_below_starting_price_fails() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &mk_asset(&env),
    );
    assert!(client
        .try_place_bid(&id, &bidder, &50_000i128, &None)
        .is_err());
}

#[test]
fn test_get_dutch_auction_price() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &200_000i128,
        &50_000i128,
        &7200u64,
        &1_000i128,
        &AuctionType::Dutch,
        &mk_asset(&env),
    );
    let price = client.get_dutch_auction_price(&id);
    assert!(price > 0);
}

#[test]
fn test_get_nonexistent_auction_fails() {
    let (_env, _cid, client) = new_env();
    assert!(client.try_get_auction(&9999u64).is_err());
}

// ─── Fee Manager ─────────────────────────────────────────────────────────────

#[test]
fn test_update_fee_config_by_admin() {
    use crate::types::FeeConfig;
    let (env, _cid, client) = new_env();
    let admin = Address::generate(&env);
    let cfg = FeeConfig {
        platform_fee_bps: 300,
        minimum_fee: 500,
        maximum_fee: 2_000_000,
        fee_recipient: admin.clone(),
        dynamic_fee_enabled: false,
        volume_discounts: soroban_sdk::Vec::new(&env),
        vip_exemptions: soroban_sdk::Vec::new(&env),
    };
    // re-initialize with known admin so we can update
    let cid2 = env.register(MarketplaceSettlement, ());
    let c2 = MarketplaceSettlementClient::new(&env, &cid2);
    c2.initialize(&admin);
    c2.update_fee_config(&cfg, &admin);
}

#[test]
fn test_update_fee_config_non_admin_fails() {
    use crate::types::FeeConfig;
    let (env, _cid, client) = new_env();
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let cfg = FeeConfig {
        platform_fee_bps: 300,
        minimum_fee: 500,
        maximum_fee: 2_000_000,
        fee_recipient: admin.clone(),
        dynamic_fee_enabled: false,
        volume_discounts: soroban_sdk::Vec::new(&env),
        vip_exemptions: soroban_sdk::Vec::new(&env),
    };
    assert!(client.try_update_fee_config(&cfg, &attacker).is_err());
}

#[test]
fn test_get_user_volume_starts_zero() {
    let (env, _cid, client) = new_env();
    let user = Address::generate(&env);
    assert_eq!(client.get_user_volume(&user), 0i128);
}

// ─── Royalty Distributor ─────────────────────────────────────────────────────

#[test]
fn test_set_and_get_royalty_info() {
    let (env, cid, _client) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    env.as_contract(&cid, || {
        let _ = RoyaltyDistributor::set_royalty_info(&env, &nft, 1, &creator, 500, &creator);
        let info = RoyaltyDistributor::get_royalty_info(&env, &nft, 1).unwrap();
        assert_eq!(info.royalty_percentage, 500);
        assert_eq!(info.creator, creator);
    });
}

#[test]
fn test_royalty_exceeds_max_fails() {
    let (env, cid, _client) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    env.as_contract(&cid, || {
        assert_eq!(
            RoyaltyDistributor::set_royalty_info(&env, &nft, 1, &creator, 5001, &creator),
            Err(SettlementError::InvalidRoyaltyPercentage)
        );
    });
}

#[test]
fn test_get_royalty_not_found_fails() {
    let (env, cid, _client) = new_env();
    let nft = Address::generate(&env);
    env.as_contract(&cid, || {
        assert_eq!(
            RoyaltyDistributor::get_royalty_info(&env, &nft, 99),
            Err(SettlementError::NotFound)
        );
    });
}

// ─── Trade ───────────────────────────────────────────────────────────────────

#[test]
fn test_create_trade_success() {
    use crate::types::{NFTItem, RoyaltyDistribution};
    let (env, _cid, client) = new_env();
    let initiator = Address::generate(&env);
    let creator = Address::generate(&env);
    let dummy = RoyaltyDistribution {
        creator_address: creator.clone(),
        creator_percentage: 500,
        seller_percentage: 9000,
        platform_percentage: 500,
        total_amount: 0,
        amounts: soroban_sdk::Map::new(&env),
    };
    let mut i_nfts = soroban_sdk::Vec::new(&env);
    i_nfts.push_back(NFTItem {
        nft_address: Address::generate(&env),
        token_id: 1,
        royalty_info: dummy.clone(),
    });
    let mut c_nfts = soroban_sdk::Vec::new(&env);
    c_nfts.push_back(NFTItem {
        nft_address: Address::generate(&env),
        token_id: 2,
        royalty_info: dummy,
    });
    let id = client.create_trade(&initiator, &None, &i_nfts, &c_nfts, &3600u64);
    assert!(id > 0);
}

#[test]
fn test_create_trade_empty_nfts_fails() {
    let (env, _cid, client) = new_env();
    let initiator = Address::generate(&env);
    let empty: soroban_sdk::Vec<crate::types::NFTItem> = soroban_sdk::Vec::new(&env);
    assert!(client
        .try_create_trade(&initiator, &None, &empty, &empty, &3600u64)
        .is_err());
}

// ─── Bundle ───────────────────────────────────────────────────────────────────

#[test]
fn test_create_bundle_success() {
    use crate::types::{NFTItem, RoyaltyDistribution};
    let (env, _cid, client) = new_env();
    let seller = Address::generate(&env);
    let creator = Address::generate(&env);
    let dummy = RoyaltyDistribution {
        creator_address: creator.clone(),
        creator_percentage: 500,
        seller_percentage: 9000,
        platform_percentage: 500,
        total_amount: 0,
        amounts: soroban_sdk::Map::new(&env),
    };
    let mut items = soroban_sdk::Vec::new(&env);
    items.push_back(NFTItem {
        nft_address: Address::generate(&env),
        token_id: 1,
        royalty_info: dummy,
    });
    let id = client.create_bundle(&seller, &items, &500_000i128, &mk_asset(&env), &86400u64);
    assert!(id > 0);
}

#[test]
fn test_create_bundle_empty_items_fails() {
    let (env, _cid, client) = new_env();
    let seller = Address::generate(&env);
    let empty: soroban_sdk::Vec<crate::types::NFTItem> = soroban_sdk::Vec::new(&env);
    assert!(client
        .try_create_bundle(&seller, &empty, &500_000i128, &mk_asset(&env), &86400u64)
        .is_err());
}

// ─── Emergency Withdrawal ────────────────────────────────────────────────────

#[test]
fn test_emergency_withdraw_non_admin_fails() {
    let (env, _cid, client) = new_env();
    let attacker = Address::generate(&env);
    let reason = Bytes::from_slice(&env, b"stuck");
    assert!(client
        .try_emergency_withdraw(&1u64, &reason, &attacker)
        .is_err());
}

// ─── Commit-Reveal ───────────────────────────────────────────────────────────

#[test]
fn test_reveal_wrong_salt_fails() {
    let (env, cid, client) = new_env();
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &mk_asset(&env),
    );
    let commitment = Bytes::from_slice(&env, b"commitment_hash");
    client.place_bid(&id, &bidder, &110_000i128, &Some(commitment));
    let wrong_salt = Bytes::from_slice(&env, b"wrong_salt");
    assert!(client
        .try_reveal_bid(&id, &bidder, &110_000i128, &wrong_salt)
        .is_err());
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

#[test]
fn test_cleanup_expired_commitments() {
    let (_env, _cid, client) = new_env();
    client.cleanup_expired_commitments();
}
