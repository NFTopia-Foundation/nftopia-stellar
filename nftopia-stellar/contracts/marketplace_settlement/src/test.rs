#![cfg(test)]

use crate::{
    error::SettlementError,
    royalty_distributor::RoyaltyDistributor,
    settlement_core::{MarketplaceSettlement, MarketplaceSettlementClient},
    types::{Asset, AuctionType, FeeConfig},
};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Bytes, Env, Symbol,
};

// --- Mock Contracts ---
#[soroban_sdk::contract]
pub struct MockToken;
#[soroban_sdk::contractimpl]
impl MockToken {
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    pub fn balance(_env: Env, _id: Address) -> i128 {
        100_000_000
    }
}

#[soroban_sdk::contract]
pub struct MockNft;
#[soroban_sdk::contractimpl]
impl MockNft {
    pub fn set_owner(env: Env, owner: Address) {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "owner"), &owner);
    }
    pub fn owner_of(env: Env, _id: u64) -> Address {
        if env
            .storage()
            .instance()
            .has(&soroban_sdk::Symbol::new(&env, "owner"))
        {
            env.storage()
                .instance()
                .get(&soroban_sdk::Symbol::new(&env, "owner"))
                .unwrap()
        } else {
            Address::generate(&env)
        }
    }
    pub fn transfer(_env: Env, _from: Address, _to: Address, _token_id: u64) {}
}

fn mk_asset(env: &Env) -> Asset {
    let contract = env.register(MockToken, ());
    Asset {
        contract,
        symbol: Symbol::new(env, "XLM"),
    }
}

fn default_fee_config(env: &Env, fee_recipient: Address) -> FeeConfig {
    FeeConfig {
        platform_fee_bps: 250,
        minimum_fee: 1000,
        maximum_fee: 1_000_000,
        fee_recipient,
        dynamic_fee_enabled: true,
        volume_discounts: soroban_sdk::Vec::new(env),
        vip_exemptions: soroban_sdk::Vec::new(env),
    }
}

fn new_env() -> (Env, Address, MarketplaceSettlementClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let cid = env.register(MarketplaceSettlement, ());
    let client = MarketplaceSettlementClient::new(&env, &cid);
    let admin = Address::generate(&env);
    let fee_config = default_fee_config(&env, admin.clone());
    client.initialize(&admin, &fee_config);
    let client: MarketplaceSettlementClient<'static> = unsafe { core::mem::transmute(client) };
    (env, cid, client, admin)
}

fn reg(env: &Env, cid: &Address, nft: &Address, creator: &Address, admin: &Address, asset: &Asset) {
    let client = MarketplaceSettlementClient::new(env, cid);
    client.add_allowed_nft_contract(admin, nft);
    client.add_allowed_token_contract(admin, &asset.contract);

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
fn test_reinitialize_fee_config_fails() {
    let (env, _cid, client, admin) = new_env();
    let fee_config = default_fee_config(&env, admin.clone());
    // A second initialize on the same contract must fail with FeeAlreadyInitialized.
    let result = client.try_initialize(&admin, &fee_config);
    assert!(result.is_err());
}

#[test]
fn test_accumulated_fees_start_zero() {
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    assert_eq!(client.get_accumulated_fees(&_asset), 0i128);
}

// ─── Sale ────────────────────────────────────────────────────────────────────

#[test]
fn test_create_sale_success() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert_eq!(id, 1u64);
}

#[test]
fn test_get_sale_after_create() {
    let (env, cid, client, _admin) = new_env();
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    let cur = mk_asset(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &cur);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &500_000i128, &cur, &3600u64);
    let sale = client.get_sale(&id);
    assert_eq!(sale.seller, seller);
    assert_eq!(sale.price, 500_000i128);
}

#[test]
fn test_cancel_sale_by_seller() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    client.cancel_transaction(&id, &Symbol::new(&env, "sale"), &seller);
}

#[test]
fn test_cancel_sale_non_seller_fails() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let attacker = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert!(client
        .try_cancel_transaction(&id, &Symbol::new(&env, "sale"), &attacker)
        .is_err());
}

#[test]
fn test_execute_sale_wrong_payment_fails() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert!(client.try_execute_sale(&id, &buyer, &999_999i128).is_err());
}

#[test]
fn test_get_nonexistent_sale_fails() {
    let (_env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&_env);
    assert!(client.try_get_sale(&9999u64).is_err());
}

// ─── Auction ─────────────────────────────────────────────────────────────────

#[test]
fn test_create_english_auction_success() {
    let (env, cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &_asset,
    );
    assert_eq!(id, 1u64);
}

#[test]
#[ignore]
fn test_create_dutch_auction_success() {
    let (env, cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &200_000i128,
        &50_000i128,
        &7200u64,
        &1_000i128,
        &AuctionType::Dutch,
        &_asset,
    );
    assert!(id > 0);
}

#[test]
fn test_create_auction_zero_price_fails() {
    let (env, cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
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
            &_asset,
        )
        .is_err());
}

#[test]
fn test_bid_below_starting_price_fails() {
    let (env, cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &_asset,
    );
    assert!(client
        .try_place_bid(&id, &bidder, &50_000i128, &None)
        .is_err());
}

#[test]
#[ignore]
fn test_get_dutch_auction_price() {
    let (env, cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &200_000i128,
        &50_000i128,
        &7200u64,
        &1_000i128,
        &AuctionType::Dutch,
        &_asset,
    );
    let price = client.get_dutch_auction_price(&id);
    assert!(price > 0);
}

#[test]
fn test_get_nonexistent_auction_fails() {
    let (_env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&_env);
    assert!(client.try_get_auction(&9999u64).is_err());
}

// ─── Fee Manager ─────────────────────────────────────────────────────────────

#[test]
fn test_update_fee_config_by_admin() {
    let (env, _cid, _client, _admin) = new_env();
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
    let init_cfg = default_fee_config(&env, admin.clone());
    c2.initialize(&admin, &init_cfg);
    c2.update_fee_config(&cfg, &admin);
}

#[test]
fn test_update_fee_config_non_admin_fails() {
    use crate::types::FeeConfig;
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
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
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let user = Address::generate(&env);
    assert_eq!(client.get_user_volume(&user), 0i128);
}

// ─── Royalty Distributor ─────────────────────────────────────────────────────

#[test]
fn test_set_and_get_royalty_info() {
    let (env, cid, _client, _admin) = new_env();
    let _asset = mk_asset(&env);
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
    let (env, cid, _client, _admin) = new_env();
    let _asset = mk_asset(&env);
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
    let (env, cid, _client, _admin) = new_env();
    let _asset = mk_asset(&env);
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
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let initiator = Address::generate(&env);
    let creator = Address::generate(&env);
    let dummy = RoyaltyDistribution {
        creator_address: creator.clone(),
        creator_percentage: 500,
        seller_address: creator.clone(),
        seller_percentage: 9000,
        platform_address: creator.clone(),
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
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
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
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let creator = Address::generate(&env);
    let dummy = RoyaltyDistribution {
        creator_address: creator.clone(),
        creator_percentage: 500,
        seller_address: creator.clone(),
        seller_percentage: 9000,
        platform_address: creator.clone(),
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
    let id = client.create_bundle(&seller, &items, &500_000i128, &_asset, &86400u64);
    assert!(id > 0);
}

#[test]
fn test_create_bundle_empty_items_fails() {
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let empty: soroban_sdk::Vec<crate::types::NFTItem> = soroban_sdk::Vec::new(&env);
    assert!(client
        .try_create_bundle(&seller, &empty, &500_000i128, &_asset, &86400u64)
        .is_err());
}

// ─── Emergency Withdrawal ────────────────────────────────────────────────────

#[test]
fn test_emergency_withdraw_non_admin_fails() {
    let (env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let attacker = Address::generate(&env);
    let reason = Bytes::from_slice(&env, b"stuck");
    assert!(client
        .try_emergency_withdraw(&1u64, &reason, &attacker)
        .is_err());
}

#[test]
fn test_reentrancy_guard_emergency_withdraw() {
    let (env, cid, client, admin) = new_env();
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("reentrant"), &true);
    });
    let reason = Bytes::from_slice(&env, b"test");
    assert!(client
        .try_emergency_withdraw(&1u64, &reason, &admin)
        .is_err());
}

#[test]
fn test_reentrancy_guard_update_fee_config() {
    use crate::types::FeeConfig;
    let (env, cid, client, admin) = new_env();
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("reentrant"), &true);
    });
    let cfg = FeeConfig {
        platform_fee_bps: 300,
        minimum_fee: 500,
        maximum_fee: 2_000_000,
        fee_recipient: admin.clone(),
        dynamic_fee_enabled: false,
        volume_discounts: soroban_sdk::Vec::new(&env),
        vip_exemptions: soroban_sdk::Vec::new(&env),
    };
    assert!(client.try_update_fee_config(&cfg, &admin).is_err());
}

#[test]
fn test_reentrancy_guard_withdraw_platform_fees() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let recipient = Address::generate(&env);
    env.as_contract(&cid, || {
        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("reentrant"), &true);
    });
    assert!(client
        .try_withdraw_platform_fees(&asset, &recipient, &admin)
        .is_err());
}

// ─── Commit-Reveal ───────────────────────────────────────────────────────────

#[test]
fn test_reveal_wrong_salt_fails() {
    let (env, cid, client, _admin) = new_env();
    let _asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    let id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &_asset,
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
    let (_env, _cid, client, _admin) = new_env();
    let _asset = mk_asset(&_env);
    client.cleanup_expired_commitments();
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

#[test]
fn test_rate_limiter_defaults_and_cooldown_active() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

    for _ in 0..10 {
        let _id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    }

    // The 11th call must fail with CooldownActive
    let res = client.try_create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);

    if let Err(Ok(invoke_error)) = res {
        let actual_error: SettlementError = invoke_error;
        assert_eq!(actual_error, SettlementError::CooldownActive);
    } else {
        panic!("Expected Err(Ok(CooldownActive)), got: {:?}", res);
    }
}

#[test]
fn test_rate_limiter_independent_users_and_functions() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller_1 = Address::generate(&env);
    let seller_2 = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller_1);

    for _ in 0..10 {
        let _id = client.create_sale(&seller_1, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    }

    let res = client.try_create_sale(&seller_1, &nft, &1u64, &1_000_000i128, &asset, &86400u64);

    if let Err(Ok(invoke_error)) = res {
        let actual_error: SettlementError = invoke_error;
        assert_eq!(actual_error, SettlementError::CooldownActive);
    } else {
        panic!("Expected Err(Ok(CooldownActive)), got: {:?}", res);
    }

    // seller_2 should NOT be blocked
    MockNftClient::new(&env, &nft).set_owner(&seller_2);
    let id_2 = client.create_sale(&seller_2, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert!(id_2 > 0);

    // seller_1 can still create_auction
    let auc_id = client.create_auction(
        &seller_1,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &asset,
    );
    assert!(auc_id > 0);
}

#[test]
fn test_rate_limiter_window_reset() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

    for _ in 0..10 {
        let _id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    }

    let res = client.try_create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);

    if let Err(Ok(invoke_error)) = res {
        let actual_error: SettlementError = invoke_error;
        assert_eq!(actual_error, SettlementError::CooldownActive);
    } else {
        panic!("Expected Err(Ok(CooldownActive)), got: {:?}", res);
    }

    // Move ledger time forward by 60 seconds
    let new_timestamp = env.ledger().timestamp() + 61;
    env.ledger().set_timestamp(new_timestamp);

    // Now it should succeed again!
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert!(id > 0);
}

#[test]
fn test_rate_limiter_admin_update_config() {
    let (env, _cid, _client, _admin) = new_env();
    let admin = Address::generate(&env);
    let asset = mk_asset(&env);

    // Setup known admin (using second client initialized with admin)
    let cid2 = env.register(MarketplaceSettlement, ());
    let c2 = MarketplaceSettlementClient::new(&env, &cid2);
    let init_cfg = default_fee_config(&env, admin.clone());
    c2.initialize(&admin, &init_cfg);

    let bidder = Address::generate(&env);
    let seller = Address::generate(&env);
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid2, &nft, &creator, &admin, &asset);

    let id = c2.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128,
        &AuctionType::English,
        &asset,
    );

    // Default rate limit for place_bid is 5 calls / 60s
    // Admin updates limit to 2 calls / 30s
    let place_bid_sym = Symbol::new(&env, "place_bid");
    c2.update_rate_limit(&place_bid_sym, &2u32, &30u64, &admin);

    // Retrieve config to verify update
    let config_opt = c2.get_rate_limit_config(&place_bid_sym);
    assert!(config_opt.is_some());
    let cfg = config_opt.unwrap();
    assert_eq!(cfg.limit, 2u32);
    assert_eq!(cfg.window_seconds, 30u64);

    // place 2 bids successfully
    c2.place_bid(&id, &bidder, &110_000i128, &None);
    c2.place_bid(&id, &bidder, &120_000i128, &None);

    // 3rd bid should fail under new configuration
    let res = c2.try_place_bid(&id, &bidder, &130_000i128, &None);

    if let Err(Ok(invoke_error)) = res {
        let actual_error: SettlementError = invoke_error;
        assert_eq!(actual_error, SettlementError::CooldownActive);
    } else {
        panic!("Expected Err(Ok(CooldownActive)), got: {:?}", res);
    }
}

#[test]
#[ignore]
fn test_minimum_bid_increment_enforcement() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

    // Create auction with 100 starting price and 1% bid increment (100 bps)
    let auction_id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128, // 1% of starting price
        &AuctionType::English,
        &asset,
    );

    // First bid at starting price should succeed
    client.place_bid(&auction_id, &bidder, &100_000i128, &None);

    // Second bid with only 0.5% increment should fail (below 1% minimum)
    let res = client.try_place_bid(&auction_id, &bidder, &100_500i128, &None);
    if let Err(Ok(invoke_error)) = res {
        let actual_error: SettlementError = invoke_error;
        assert_eq!(actual_error, SettlementError::BidBelowMinimumIncrement);
    } else {
        panic!("Expected Err(Ok(BidBelowMinimumIncrement)), got: {:?}", res);
    }

    // Bid with 1% increment should succeed
    client.place_bid(&auction_id, &bidder, &101_000i128, &None);
}

#[test]
fn test_auction_bid_increment_validation_on_creation() {
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

    // Try to create auction with bid_increment below minimum (0.5% instead of 1%)
    let res = client.try_create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &500i128, // 0.5% of starting price - should fail
        &AuctionType::English,
        &asset,
    );

    if let Err(Ok(invoke_error)) = res {
        let actual_error: SettlementError = invoke_error;
        assert_eq!(actual_error, SettlementError::InvalidBidIncrement);
    } else {
        panic!("Expected Err(Ok(InvalidBidIncrement)), got: {:?}", res);
    }

    // Create auction with valid bid_increment (1%)
    let auction_id = client.create_auction(
        &seller,
        &nft,
        &1u64,
        &100_000i128,
        &80_000i128,
        &3600u64,
        &1_000i128, // 1% of starting price - should succeed
        &AuctionType::English,
        &asset,
    );
    assert!(auction_id > 0);
}

#[test]
#[ignore]
fn test_admin_update_min_bid_increment() {
    // Skipped: update_min_bid_increment API not exposed on settlement client in current build
}
