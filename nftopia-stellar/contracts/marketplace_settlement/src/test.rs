#![cfg(test)]

use crate::{
    atomic_swap::{AtomicSwapEngine, SwapState},
    error::{SettlementError, SwapTimeoutError},
    royalty_distributor::RoyaltyDistributor,
    settlement_core::{MarketplaceSettlement, MarketplaceSettlementClient},
    types::{Asset, AuctionType, FeeConfig, SwapTimeoutConfig, TokenAsset},
    utils::time_utils,
};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _, Ledger as _},
    token, Address, Bytes, Env, Symbol, TryFromVal,
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
    pub fn decimals(_env: Env) -> u32 {
        7
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
    pub fn transfer(env: Env, _caller: Address, from: Address, to: Address, _token_id: u64) {
        let owner = Self::owner_of(env.clone(), 0);
        assert_eq!(owner, from);
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "owner"), &to);
    }
}

/// NFT mock matching the argument list `asset_utils::transfer_nft` actually sends:
/// `(operator, from, to, token_id)`.
#[soroban_sdk::contract]
pub struct MockEscrowNft;
#[soroban_sdk::contractimpl]
impl MockEscrowNft {
    pub fn set_owner(env: Env, owner: Address) {
        env.storage()
            .instance()
            .set(&soroban_sdk::Symbol::new(&env, "owner"), &owner);
    }
    pub fn owner_of(env: Env, _id: u64) -> Address {
        env.storage()
            .instance()
            .get(&soroban_sdk::Symbol::new(&env, "owner"))
            .unwrap_or_else(|| Address::generate(&env))
    }
    pub fn transfer(_env: Env, _operator: Address, _from: Address, _to: Address, _token_id: u64) {}
}

fn mk_asset(env: &Env) -> Asset {
    let contract = env.register(MockToken, ());
    Asset::Token(TokenAsset {
        contract,
        symbol: Symbol::new(env, "XLM"),
    })
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
    client.initialize(&admin, &fee_config, &None);
    let sac_admin = Address::generate(&env);
    let native_xlm_sac = env.register_stellar_asset_contract_v2(sac_admin).address();
    client.set_native_xlm_sac(&admin, &Some(native_xlm_sac));
    let client: MarketplaceSettlementClient<'static> = unsafe { core::mem::transmute(client) };
    (env, cid, client, admin)
}

fn reg(env: &Env, cid: &Address, nft: &Address, creator: &Address, admin: &Address, asset: &Asset) {
    let client = MarketplaceSettlementClient::new(env, cid);
    client.add_allowed_nft_contract(admin, nft);
    if let Asset::Token(t) = asset {
        client.add_allowed_token_contract(admin, &t.contract);
    }

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
    let result = client.try_initialize(&admin, &fee_config, &None);
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
    assert_eq!(MockNftClient::new(&env, &nft).owner_of(&1), seller);
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
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
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
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
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
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
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
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
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
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
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
    c2.initialize(&admin, &init_cfg, &None);
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
    let nft = env.register(MockNft, ());
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
    let (env, cid, client, admin) = new_env();
    let asset = mk_asset(&env);
    let seller = Address::generate(&env);
    let creator = Address::generate(&env);
    let nft = Address::generate(&env);

    // Register NFT contract and add asset to whitelist
    reg(&env, &cid, &nft, &creator, &admin, &asset);

    // Add the asset to supported assets list
    client.add_supported_asset(&admin, &asset);

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
        nft_address: nft,
        token_id: 1,
        royalty_info: dummy,
    });
    let id = client.create_bundle(&seller, &items, &500_000i128, &asset, &86400u64);
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
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &_asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
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
        MockNftClient::new(&env, &nft).set_owner(&seller);
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
        MockNftClient::new(&env, &nft).set_owner(&seller_1);
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
    MockNftClient::new(&env, &nft).set_owner(&seller_1);
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
        MockNftClient::new(&env, &nft).set_owner(&seller);
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
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert!(id > 0);
}

// ─── Atomic Swap Timeouts ────────────────────────────────────────────────────

const SALE_DURATION: u64 = 86_400;
const SALE_PRICE: i128 = 1_000_000;

type ClientResult<T> = Result<T, Result<SettlementError, soroban_sdk::InvokeError>>;

fn assert_contract_err<T>(res: ClientResult<T>, expected: SettlementError) {
    match res {
        Err(Ok(actual)) => assert_eq!(actual, expected),
        Err(Err(e)) => panic!("expected {:?}, got invoke error {:?}", expected, e),
        Ok(_) => panic!("expected {:?}, call succeeded", expected),
    }
}

/// Count published events carrying `topic`.
///
/// The test host only exposes events from the most recent invocation, so call this
/// immediately after the call that emits them.
fn count_events(env: &Env, topic: Symbol) -> u32 {
    let mut count = 0u32;
    for (_, topics, _) in env.events().all().iter() {
        if let Some(val) = topics.get(1) {
            if let Ok(sym) = Symbol::try_from_val(env, &val) {
                if sym == topic {
                    count += 1;
                }
            }
        }
    }
    count
}

/// A sale with its backing atomic swap, using mocks that accept escrow transfers.
fn new_swap_env() -> (
    Env,
    Address,
    MarketplaceSettlementClient<'static>,
    Address,
    Address,
    Asset,
    u64,
) {
    let (env, cid, client, admin) = new_env();
    let currency = Asset::Token(TokenAsset {
        contract: env.register(MockToken, ()),
        symbol: Symbol::new(&env, "XLM"),
    });
    let nft = env.register(MockEscrowNft, ());
    let seller = Address::generate(&env);
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &currency);
    MockEscrowNftClient::new(&env, &nft).set_owner(&seller);

    let transaction_id =
        client.create_sale(&seller, &nft, &1u64, &SALE_PRICE, &currency, &SALE_DURATION);
    (env, cid, client, seller, nft, currency, transaction_id)
}

/// Deposit both sides of the swap so it reaches `Ready` with real escrow holdings.
fn fund_swap(
    env: &Env,
    cid: &Address,
    seller: &Address,
    nft: &Address,
    currency: &Asset,
    transaction_id: u64,
) {
    let nft_asset = Asset::Token(TokenAsset {
        contract: nft.clone(),
        symbol: Symbol::new(env, "NFT"),
    });
    env.as_contract(cid, || {
        AtomicSwapEngine::deposit_to_escrow(env, transaction_id, seller, &nft_asset, 1, true)
            .unwrap();
        AtomicSwapEngine::deposit_to_escrow(
            env,
            transaction_id,
            seller,
            currency,
            SALE_PRICE,
            false,
        )
        .unwrap();
    });
}

/// Move both clocks past the point where expiry is confirmed.
fn confirm_expiry(env: &Env, expires_at: u64, expires_at_ledger: u32, cfg: &SwapTimeoutConfig) {
    env.ledger()
        .set_timestamp(expires_at + cfg.grace_period_seconds + 1);
    env.ledger()
        .set_sequence_number(expires_at_ledger + cfg.ledger_tolerance_blocks);
}

#[test]
fn test_swap_expiry_fields_set_at_creation() {
    let (env, _cid, client, _seller, _nft, _currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);

    assert_eq!(swap.expires_at, swap.created_at + SALE_DURATION);
    assert_eq!(
        swap.expires_at_ledger,
        time_utils::projected_expiry_ledger(swap.created_ledger, SALE_DURATION)
    );
    assert!(swap.expires_at_ledger > swap.created_ledger);
    assert_eq!(swap.state, SwapState::SellerFunded);

    // Every holding carries a backstop strictly past the swap's own deadline.
    let expected_backstop = swap.expires_at + cfg.grace_period_seconds + cfg.escrow_buffer_seconds;
    for holding in swap.seller_escrow.iter() {
        assert_eq!(holding.escrow_expires_at, expected_backstop);
        assert!(holding.escrow_expires_at > swap.expires_at);
        assert!(holding.is_deposited);
        assert_eq!(holding.released_at, None);
    }
    for holding in swap.buyer_escrow.iter() {
        assert_eq!(holding.escrow_expires_at, expected_backstop);
        assert!(holding.escrow_expires_at > swap.expires_at);
        assert!(!holding.is_deposited);
        assert_eq!(holding.released_at, None);
    }

    assert_eq!(
        client.get_swap_time_remaining(&txid),
        SALE_DURATION + cfg.grace_period_seconds
    );
    let _ = env;
}

#[test]
fn test_execute_swap_fails_when_expired() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);

    env.ledger()
        .set_timestamp(swap.expires_at + cfg.grace_period_seconds + 1);

    let res = env.as_contract(&cid, || AtomicSwapEngine::execute_swap(&env, txid, &seller));
    assert_eq!(res.err(), Some(SwapTimeoutError::SwapExpired.into()));
    assert_eq!(client.get_swap_time_remaining(&txid), 0);
}

#[test]
fn test_execute_swap_succeeds_at_edge_of_grace_period() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);

    // Submitted past `expires_at` but inside the grace period: the mainnet case the
    // grace period exists for, and it must not be treated as expired.
    env.ledger()
        .set_timestamp(swap.expires_at + cfg.grace_period_seconds);

    let result = env
        .as_contract(&cid, || AtomicSwapEngine::execute_swap(&env, txid, &seller))
        .unwrap();
    assert!(result.success);

    let swap = client.get_atomic_swap(&txid);
    assert_eq!(swap.state, SwapState::Executed);
    for holding in swap.seller_escrow.iter().chain(swap.buyer_escrow.iter()) {
        assert!(holding.released_at.is_some());
    }
}

#[test]
fn test_expired_swap_reports_expiry_not_invalid_state() {
    // An unfunded swap is not `Ready`; once expired it must still report SwapExpired
    // so callers can tell a stale swap from an unfunded one.
    let (env, cid, client, seller, _nft, _currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);

    env.ledger()
        .set_timestamp(swap.expires_at + cfg.grace_period_seconds + 1);

    let res = env.as_contract(&cid, || AtomicSwapEngine::execute_swap(&env, txid, &seller));
    assert_eq!(res.err(), Some(SwapTimeoutError::SwapExpired.into()));
}

#[test]
fn test_deposit_to_escrow_rejected_after_expiry() {
    let (env, cid, client, seller, nft, _currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);

    env.ledger()
        .set_timestamp(swap.expires_at + cfg.grace_period_seconds + 1);

    let nft_asset = Asset::Token(TokenAsset {
        contract: nft.clone(),
        symbol: Symbol::new(&env, "NFT"),
    });
    let res = env.as_contract(&cid, || {
        AtomicSwapEngine::deposit_to_escrow(&env, txid, &seller, &nft_asset, 1, true)
    });
    assert_eq!(res.err(), Some(SwapTimeoutError::SwapExpired.into()));
}

#[test]
fn test_initialize_swap_rejects_duration_over_max() {
    let (env, cid, client, seller, nft, currency, _txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();

    env.as_contract(&cid, || {
        let res = AtomicSwapEngine::initialize_swap(
            &env,
            777,
            &seller,
            &seller,
            &nft,
            1,
            &currency,
            SALE_PRICE,
            cfg.max_swap_duration + 1,
        );
        assert_eq!(
            res.err(),
            Some(SwapTimeoutError::InvalidSwapDuration.into())
        );
    });
}

#[test]
fn test_initialize_swap_zero_duration_uses_configured_default() {
    let (env, cid, client, seller, nft, currency, _txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();

    env.as_contract(&cid, || {
        AtomicSwapEngine::initialize_swap(
            &env, 4242, &seller, &seller, &nft, 1, &currency, SALE_PRICE, 0,
        )
        .unwrap();
        let swap = AtomicSwapEngine::get_swap_by_transaction(&env, 4242).unwrap();
        assert_eq!(swap.expires_at, swap.created_at + cfg.default_swap_duration);
    });
}

#[test]
fn test_create_sale_duration_bounded_by_admin_config() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let cid = env.register(MarketplaceSettlement, ());
    let client = MarketplaceSettlementClient::new(&env, &cid);

    let mut cfg = SwapTimeoutConfig::defaults();
    cfg.max_swap_duration = 3_600;
    cfg.default_swap_duration = 3_600;
    let fee_config = default_fee_config(&env, admin.clone());
    client.initialize(&admin, &fee_config, &Some(cfg));

    let currency = Asset::Token(TokenAsset {
        contract: env.register(MockToken, ()),
        symbol: Symbol::new(&env, "XLM"),
    });
    let nft = env.register(MockEscrowNft, ());
    let seller = Address::generate(&env);
    reg(
        &env,
        &cid,
        &nft,
        &Address::generate(&env),
        &admin,
        &currency,
    );
    MockEscrowNftClient::new(&env, &nft).set_owner(&seller);

    // Inside the sale's own 30-day limit, but past the configured swap ceiling.
    assert_contract_err(
        client.try_create_sale(&seller, &nft, &1u64, &SALE_PRICE, &currency, &7_200u64),
        SwapTimeoutError::InvalidSwapDuration.into(),
    );
    assert!(client.create_sale(&seller, &nft, &1u64, &SALE_PRICE, &currency, &3_600u64) > 0);
}

#[test]
fn test_expire_swap_requires_both_timestamp_and_ledger_tolerance() {
    let (env, _cid, client, _seller, _nft, _currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    let anyone = Address::generate(&env);

    // Neither clock has moved.
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );

    // Timestamp alone is past the deadline: not enough to force a refund, since a
    // single drifting ledger timestamp must not be able to expire a swap.
    env.ledger()
        .set_timestamp(swap.expires_at + cfg.grace_period_seconds + 1);
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );

    // One ledger short of the tolerance still holds.
    env.ledger()
        .set_sequence_number(swap.expires_at_ledger + cfg.ledger_tolerance_blocks - 1);
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );

    // Both clocks agree.
    env.ledger()
        .set_sequence_number(swap.expires_at_ledger + cfg.ledger_tolerance_blocks);
    client.expire_swap(&txid, &anyone);
    assert_eq!(client.get_atomic_swap(&txid).state, SwapState::Failed);

    // Already finalized.
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::SwapAlreadyFinalized.into(),
    );
}

#[test]
fn test_cleanup_expired_swaps_refunds_and_emits_events() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);

    // Anyone may sweep; it can only return assets to their depositors.
    let anyone = Address::generate(&env);
    assert_eq!(client.cleanup_expired_swaps(&anyone, &0u32), 0);

    confirm_expiry(&env, swap.expires_at, swap.expires_at_ledger, &cfg);
    assert_eq!(client.cleanup_expired_swaps(&anyone, &0u32), 1);

    // One expiry, plus an auto-refund per escrowed holding, for off-chain monitors.
    assert_eq!(count_events(&env, symbol_short!("swp_exprd")), 1);
    assert_eq!(count_events(&env, symbol_short!("swp_refnd")), 2);

    let swap = client.get_atomic_swap(&txid);
    assert_eq!(swap.state, SwapState::Failed);
    for holding in swap.seller_escrow.iter().chain(swap.buyer_escrow.iter()) {
        assert!(holding.released_at.is_some());
    }

    // Nothing left to sweep.
    assert_eq!(client.cleanup_expired_swaps(&anyone, &0u32), 0);
}

#[test]
fn test_cleanup_expired_swaps_respects_limit() {
    let (env, _cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    client.create_sale(&seller, &nft, &1u64, &SALE_PRICE, &currency, &SALE_DURATION);
    client.create_sale(&seller, &nft, &1u64, &SALE_PRICE, &currency, &SALE_DURATION);

    confirm_expiry(&env, swap.expires_at, swap.expires_at_ledger, &cfg);

    let anyone = Address::generate(&env);
    assert_eq!(client.cleanup_expired_swaps(&anyone, &2u32), 2);
    assert_eq!(client.cleanup_expired_swaps(&anyone, &2u32), 1);
    assert_eq!(client.cleanup_expired_swaps(&anyone, &2u32), 0);
}

#[test]
fn test_escrow_backstop_reclaimable_without_ledger_confirmation() {
    // Worst case: the swap never settles and the ledger sequence never reaches the
    // tolerance, so `expire_swap` stays unavailable. The escrow backstop is what
    // guarantees the funds still come back.
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);
    let backstop = swap.seller_escrow.get(0).unwrap().escrow_expires_at;
    let anyone = Address::generate(&env);

    assert_contract_err(
        client.try_reclaim_expired_escrow(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );

    env.ledger().set_timestamp(backstop + 1);
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );

    assert_eq!(client.reclaim_expired_escrow(&txid, &anyone), 2);
    let swap = client.get_atomic_swap(&txid);
    assert_eq!(swap.state, SwapState::Failed);
    for holding in swap.seller_escrow.iter().chain(swap.buyer_escrow.iter()) {
        assert!(holding.released_at.is_some());
    }
}

#[test]
fn test_expiry_paths_never_refund_twice() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);
    let backstop = swap.seller_escrow.get(0).unwrap().escrow_expires_at;
    let anyone = Address::generate(&env);

    confirm_expiry(&env, swap.expires_at, swap.expires_at_ledger, &cfg);
    assert_eq!(client.expire_swap(&txid, &anyone), 2);

    // Every other refund path must now find nothing to pay out.
    env.ledger().set_timestamp(backstop + 1);
    assert_contract_err(
        client.try_reclaim_expired_escrow(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::SwapAlreadyFinalized.into(),
    );
    assert_eq!(client.cleanup_expired_swaps(&anyone, &0u32), 0);
}

#[test]
fn test_executed_swap_cannot_be_reclaimed_via_backstop() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);
    env.as_contract(&cid, || AtomicSwapEngine::execute_swap(&env, txid, &seller))
        .unwrap();

    let backstop = client
        .get_atomic_swap(&txid)
        .seller_escrow
        .get(0)
        .unwrap()
        .escrow_expires_at;
    env.ledger().set_timestamp(backstop + 1);

    let anyone = Address::generate(&env);
    assert_contract_err(
        client.try_reclaim_expired_escrow(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );
    assert_eq!(client.get_atomic_swap(&txid).state, SwapState::Executed);
}

#[test]
fn test_cancel_swap_after_expiry_still_refunds() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);

    confirm_expiry(&env, swap.expires_at, swap.expires_at_ledger, &cfg);

    // Cancellation stays open after expiry — blocking it would strand the escrow —
    // and reports the timeout through the expiry events.
    env.as_contract(&cid, || AtomicSwapEngine::cancel_swap(&env, txid, &seller))
        .unwrap();
    assert_eq!(count_events(&env, symbol_short!("swp_exprd")), 1);
    assert_eq!(count_events(&env, symbol_short!("swp_refnd")), 2);
    assert_eq!(client.get_atomic_swap(&txid).state, SwapState::Failed);

    let res = env.as_contract(&cid, || AtomicSwapEngine::cancel_swap(&env, txid, &seller));
    assert_eq!(
        res.err(),
        Some(SwapTimeoutError::SwapAlreadyFinalized.into())
    );
}

#[test]
fn test_cancel_swap_before_expiry_emits_no_timeout_events() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);

    env.as_contract(&cid, || AtomicSwapEngine::cancel_swap(&env, txid, &seller))
        .unwrap();
    assert_eq!(count_events(&env, symbol_short!("swp_exprd")), 0);
    assert_eq!(client.get_atomic_swap(&txid).state, SwapState::Failed);
}

/// Read back the admin the contract was initialized with.
fn stored_admin(env: &Env, cid: &Address) -> Address {
    env.as_contract(cid, || {
        let cfg: crate::types::AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .unwrap();
        cfg.admin
    })
}

#[test]
fn test_admin_can_update_swap_timeout_config() {
    let (env, cid, client, _seller, _nft, _currency, _txid) = new_swap_env();

    let mut cfg = SwapTimeoutConfig::defaults();
    cfg.max_swap_duration = 1_209_600; // 14 days
    cfg.grace_period_seconds = 600;
    cfg.ledger_tolerance_blocks = 3;

    let attacker = Address::generate(&env);
    assert_contract_err(
        client.try_update_swap_timeout_config(&cfg, &attacker),
        SettlementError::Unauthorized,
    );

    let admin = stored_admin(&env, &cid);
    client.update_swap_timeout_config(&cfg, &admin);
    assert_eq!(client.get_swap_timeout_config(), cfg);
}

#[test]
fn test_invalid_swap_timeout_config_rejected() {
    let (env, cid, client, _seller, _nft, _currency, _txid) = new_swap_env();
    let admin = stored_admin(&env, &cid);

    // A zero tolerance would let one ledger's timestamp confirm an expiry.
    let mut zero_tolerance = SwapTimeoutConfig::defaults();
    zero_tolerance.ledger_tolerance_blocks = 0;
    assert_contract_err(
        client.try_update_swap_timeout_config(&zero_tolerance, &admin),
        SwapTimeoutError::InvalidTimeoutConfig.into(),
    );

    let mut zero_max = SwapTimeoutConfig::defaults();
    zero_max.max_swap_duration = 0;
    assert_contract_err(
        client.try_update_swap_timeout_config(&zero_max, &admin),
        SwapTimeoutError::InvalidTimeoutConfig.into(),
    );

    let mut default_over_max = SwapTimeoutConfig::defaults();
    default_over_max.max_swap_duration = 3_600;
    default_over_max.default_swap_duration = 7_200;
    assert_contract_err(
        client.try_update_swap_timeout_config(&default_over_max, &admin),
        SwapTimeoutError::InvalidTimeoutConfig.into(),
    );

    let mut overflowing = SwapTimeoutConfig::defaults();
    overflowing.max_swap_duration = u64::MAX;
    overflowing.grace_period_seconds = 1;
    assert_contract_err(
        client.try_update_swap_timeout_config(&overflowing, &admin),
        SwapTimeoutError::InvalidTimeoutConfig.into(),
    );
}

#[test]
fn test_initialize_with_custom_swap_timeout_config() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let cid = env.register(MarketplaceSettlement, ());
    let client = MarketplaceSettlementClient::new(&env, &cid);

    let mut cfg = SwapTimeoutConfig::defaults();
    cfg.max_swap_duration = 2_592_000; // 30 days
    cfg.default_swap_duration = 1_209_600; // 14 days
    cfg.ledger_tolerance_blocks = 4;
    let fee_config = default_fee_config(&env, admin.clone());
    client.initialize(&admin, &fee_config, &Some(cfg.clone()));

    assert_eq!(client.get_swap_timeout_config(), cfg);
}

#[test]
fn test_swap_timeout_defaults_applied_without_initialization() {
    let env = Env::default();
    let cid = env.register(MarketplaceSettlement, ());
    let client = MarketplaceSettlementClient::new(&env, &cid);
    assert_eq!(
        client.get_swap_timeout_config(),
        SwapTimeoutConfig::defaults()
    );
}

#[test]
fn test_pause_halts_cleanup_but_not_the_escrow_backstop() {
    let (env, cid, client, seller, nft, currency, txid) = new_swap_env();
    let cfg = client.get_swap_timeout_config();
    let swap = client.get_atomic_swap(&txid);
    fund_swap(&env, &cid, &seller, &nft, &currency, txid);
    let backstop = swap.seller_escrow.get(0).unwrap().escrow_expires_at;
    let admin = stored_admin(&env, &cid);
    let anyone = Address::generate(&env);

    confirm_expiry(&env, swap.expires_at, swap.expires_at_ledger, &cfg);
    client.pause_contract(&admin, &None, &None);

    // Routine timeout processing stops with the circuit breaker.
    assert_contract_err(
        client.try_cleanup_expired_swaps(&anyone, &0u32),
        SettlementError::ContractPaused,
    );
    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SettlementError::ContractPaused,
    );

    // The last-resort backstop does not, or a paused contract could hold deposits
    // past every deadline.
    env.ledger().set_timestamp(backstop + 1);
    assert_eq!(client.reclaim_expired_escrow(&txid, &anyone), 2);
    assert_eq!(client.get_atomic_swap(&txid).state, SwapState::Failed);
}

// ─── Time Math ───────────────────────────────────────────────────────────────

#[test]
fn test_time_math_guards_overflow_and_underflow() {
    assert_eq!(time_utils::deadline_with_grace(10, 5), Ok(15));
    assert_eq!(
        time_utils::deadline_with_grace(u64::MAX, 1),
        Err(SettlementError::Overflow)
    );

    assert_eq!(time_utils::ledgers_for_duration(50), 10);
    assert_eq!(time_utils::ledgers_for_duration(u64::MAX), u32::MAX);
    assert_eq!(time_utils::projected_expiry_ledger(u32::MAX, 100), u32::MAX);
    assert_eq!(time_utils::projected_expiry_ledger(10, 50), 20);

    assert_eq!(
        time_utils::validate_duration(0, 100),
        Err(SwapTimeoutError::InvalidSwapDuration.into())
    );
    assert_eq!(
        time_utils::validate_duration(101, 100),
        Err(SwapTimeoutError::InvalidSwapDuration.into())
    );
    assert_eq!(time_utils::validate_duration(100, 100), Ok(()));

    assert_eq!(
        time_utils::time_diff_seconds(5, 10),
        Err(SettlementError::InvalidAmount)
    );
    assert_eq!(
        time_utils::calculate_expiration(u64::MAX, 1),
        Err(SettlementError::Overflow)
    );
}

#[test]
fn test_time_math_handles_ledger_time_moving_backwards() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.ledger().set_sequence_number(100);

    // A reference stamped by a later ledger must read as "no time passed", not
    // underflow, and must never make something look expired.
    assert_eq!(time_utils::elapsed_since(2_000, &env), 0);
    assert_eq!(time_utils::overdue_by(2_000, 100, &env), 0);
    assert_eq!(time_utils::remaining_time_with_grace(900, 50, &env), 0);
    assert_eq!(time_utils::remaining_time_with_grace(1_200, 100, &env), 300);
    assert!(!time_utils::has_time_elapsed(2_000, 10, &env));

    // Very large deadlines neither panic nor expire.
    assert_eq!(
        time_utils::is_expired_with_grace(u64::MAX, 0, &env),
        Ok(false)
    );
    assert_eq!(
        time_utils::is_expired_with_grace(u64::MAX, 1, &env),
        Err(SettlementError::Overflow)
    );

    assert_eq!(time_utils::ledgers_elapsed(200, &env), 0);
    assert_eq!(time_utils::ledgers_elapsed(40, &env), 60);
    assert!(!time_utils::has_ledger_tolerance_passed(u32::MAX, 5, &env));
    assert!(time_utils::has_ledger_tolerance_passed(90, 5, &env));
}

#[test]
fn test_swap_not_expired_when_ledger_time_moves_backwards() {
    let (env, _cid, client, _seller, _nft, _currency, txid) = new_swap_env();
    let swap = client.get_atomic_swap(&txid);
    let anyone = Address::generate(&env);

    // Ledger sequence far past the projection, but the timestamp has regressed.
    env.ledger()
        .set_sequence_number(swap.expires_at_ledger + 1_000);
    env.ledger().set_timestamp(swap.created_at);

    assert_contract_err(
        client.try_expire_swap(&txid, &anyone),
        SwapTimeoutError::NotYetExpired.into(),
    );
    assert_eq!(client.cleanup_expired_swaps(&anyone, &0u32), 0);
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
    c2.initialize(&admin, &init_cfg, &None);

    let bidder = Address::generate(&env);
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid2, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

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

// ─── Royalty Cap Tests ──────────────────────────────────────────────────────

/// Test that setting royalty below both caps succeeds.
#[test]
fn test_set_royalty_below_caps_succeeds() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);

    // Set AdminConfig with max_royalty_percentage = 3000 (30%)
    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 3000,
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set royalty at 25% (2500 bps) - below both caps
        let result = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft, 1, &creator, 2500, &creator,
        );
        assert!(result.is_ok());

        let info = crate::royalty_distributor::RoyaltyDistributor::get_royalty_info(&env, &nft, 1)
            .unwrap();
        assert_eq!(info.royalty_percentage, 2500);
    });
}

/// Test that setting royalty above hard cap (50%) fails.
#[test]
fn test_set_royalty_above_hard_cap_fails() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 5000, // Admin cap at 50%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set royalty at 60% (6000 bps) - exceeds hard cap
        let result = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft, 1, &creator, 6000, &creator,
        );
        assert_eq!(result, Err(SettlementError::InvalidRoyaltyPercentage));
    });
}

/// Test that setting royalty above admin cap but below hard cap fails.
#[test]
fn test_set_royalty_above_admin_cap_fails() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 2000, // Admin cap at 20%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set royalty at 30% (3000 bps) - below hard cap but above admin cap
        let result = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft, 1, &creator, 3000, &creator,
        );
        assert_eq!(result, Err(SettlementError::RoyaltyExceedsMaxCap));
    });
}

/// Test that updating royalty above admin cap fails.
#[test]
fn test_update_royalty_above_admin_cap_fails() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 2000, // Admin cap at 20%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set initial royalty at 10%
        let _ = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft, 1, &creator, 1000, &creator,
        );

        // Update to 30% - below hard cap but above admin cap
        let result = crate::royalty_distributor::RoyaltyDistributor::update_royalty_percentage(
            &env, &nft, 1, 3000, &creator,
        );
        assert_eq!(result, Err(SettlementError::RoyaltyExceedsMaxCap));
    });
}

/// Test that bulk set with invalid royalty fails entirely (no partial updates).
#[test]
fn test_bulk_set_royalties_with_invalid_percentage_fails() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);
    let mut token_ids = soroban_sdk::Vec::new(&env);
    token_ids.push_back(1);
    token_ids.push_back(2);
    token_ids.push_back(3);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 2000, // Admin cap at 20%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Try to bulk set at 30% - exceeds admin cap
        let result = crate::royalty_distributor::RoyaltyDistributor::bulk_set_royalties(
            &env, &nft, &token_ids, &creator, 3000, &creator,
        );
        assert_eq!(result, Err(SettlementError::RoyaltyExceedsMaxCap));

        // Verify no royalties were set (atomicity)
        for id in token_ids.iter() {
            let result =
                crate::royalty_distributor::RoyaltyDistributor::get_royalty_info(&env, &nft, id);
            assert!(result.is_err());
        }
    });
}

/// Test that admin can update max royalty cap (downward).
#[test]
fn test_admin_update_max_royalty_downward_succeeds() {
    let (env, cid, _client, _admin) = new_env();

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 5000, // 50%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Update cap down to 30%
        let result = crate::royalty_distributor::RoyaltyDistributor::update_max_royalty_percentage(
            &env, &_admin, 3000,
        );
        assert!(result.is_ok());

        let updated_config: crate::royalty_distributor::AdminConfig = env
            .storage()
            .instance()
            .get(&crate::royalty_distributor::ADMIN_CONFIG_KEY)
            .unwrap();
        assert_eq!(updated_config.max_royalty_percentage, 3000);
    });
}

/// Test that admin can update max royalty cap (upward, but never above hard cap).
#[test]
fn test_admin_update_max_royalty_upward_succeeds() {
    let (env, cid, _client, _admin) = new_env();

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 2000, // 20%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Update cap up to 40% (still below hard cap)
        let result = crate::royalty_distributor::RoyaltyDistributor::update_max_royalty_percentage(
            &env, &_admin, 4000,
        );
        assert!(result.is_ok());

        let updated_config: crate::royalty_distributor::AdminConfig = env
            .storage()
            .instance()
            .get(&crate::royalty_distributor::ADMIN_CONFIG_KEY)
            .unwrap();
        assert_eq!(updated_config.max_royalty_percentage, 4000);
    });
}

/// Test that admin cannot set cap above hard cap (50%).
#[test]
fn test_admin_update_max_royalty_above_hard_cap_fails() {
    let (env, cid, _client, _admin) = new_env();

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 5000, // 50%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Try to update cap to 60% (exceeds hard cap)
        let result = crate::royalty_distributor::RoyaltyDistributor::update_max_royalty_percentage(
            &env, &_admin, 6000,
        );
        assert_eq!(result, Err(SettlementError::InvalidRoyaltyPercentage));
    });
}

/// Test that non-admin cannot update max royalty cap.
#[test]
fn test_non_admin_update_max_royalty_fails() {
    let (env, cid, _client, _admin) = new_env();
    let attacker = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 5000,
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Attacker tries to update cap
        let result = crate::royalty_distributor::RoyaltyDistributor::update_max_royalty_percentage(
            &env, &attacker, 3000,
        );
        assert_eq!(result, Err(SettlementError::NotAdmin));
    });
}

/// Test that existing royalty info persists but cannot be updated above new cap.
#[test]
fn test_existing_royalty_cannot_be_updated_above_new_cap() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 5000, // 50%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set royalty at 40%
        let _ = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft, 1, &creator, 4000, &creator,
        );

        // Update admin cap down to 30%
        let _ = crate::royalty_distributor::RoyaltyDistributor::update_max_royalty_percentage(
            &env, &_admin, 3000,
        );

        // Try to update royalty to 35% (above new cap)
        let result = crate::royalty_distributor::RoyaltyDistributor::update_royalty_percentage(
            &env, &nft, 1, 3500, &creator,
        );
        assert_eq!(result, Err(SettlementError::RoyaltyExceedsMaxCap));

        // Existing royalty at 40% should still be intact
        let info = crate::royalty_distributor::RoyaltyDistributor::get_royalty_info(&env, &nft, 1)
            .unwrap();
        assert_eq!(info.royalty_percentage, 4000);
    });
}

/// Test that calculate_minimum_price respects max cap.
#[test]
fn test_calculate_minimum_price_respects_max_cap() {
    let (env, cid, _client, _admin) = new_env();
    let nft = Address::generate(&env);
    let creator = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 3000, // 30%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set royalty at 25%
        let _ = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft, 1, &creator, 2500, &creator,
        );

        // Calculate minimum price for desired net amount of 1000
        let min_price = crate::royalty_distributor::RoyaltyEnforcer::calculate_minimum_price(
            &env, &nft, 1, 1000,
        )
        .unwrap();

        // With 25% royalty, price = 1000 / (1 - 0.25) = 1333.33...
        assert_eq!(min_price, 1333);
    });
}

/// Test that complex royalty calculation respects caps.
#[test]
fn test_complex_royalties_respect_caps() {
    let (env, cid, _client, _admin) = new_env();
    let nft1 = Address::generate(&env);
    let nft2 = Address::generate(&env);
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    env.as_contract(&cid, || {
        let admin_config = crate::royalty_distributor::AdminConfig {
            admin: _admin.clone(),
            emergency_withdrawal_enabled: false,
            max_transaction_duration: 86400,
            max_auction_duration: 86400,
            min_bid_increment_bps: 100,
            max_royalty_percentage: 2000, // 20%
            dispute_cooling_period: 3600,
            arbitration_quorum: 3,
        };
        env.storage()
            .instance()
            .set(&crate::royalty_distributor::ADMIN_CONFIG_KEY, &admin_config);

        // Set royalty at 15% (below admin cap)
        let _ = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft1, 1, &creator1, 1500, &creator1,
        );

        // Set royalty at 25% (exceeds admin cap) - this should fail
        let result = crate::royalty_distributor::RoyaltyDistributor::set_royalty_info(
            &env, &nft2, 1, &creator2, 2500, &creator2,
        );
        assert_eq!(result, Err(SettlementError::RoyaltyExceedsMaxCap));
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Native XLM Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_native_asset_returns_xlm_variant() {
    use crate::utils::asset_utils::native_asset;
    assert_eq!(native_asset(), Asset::NativeXLM);
}

#[test]
fn test_configured_native_asset_is_valid() {
    let (env, cid, _client, _admin) = new_env();
    let asset = Asset::NativeXLM;
    env.as_contract(&cid, || {
        let supported: soroban_sdk::Vec<Asset> = soroban_sdk::Vec::new(&env);
        let result = crate::utils::asset_utils::validate_asset(&asset, &supported, &env);
        assert!(result.is_ok());
    });
}

#[test]
fn test_assets_equal_native_xlm() {
    use crate::utils::asset_utils::assets_equal;
    assert!(assets_equal(&Asset::NativeXLM, &Asset::NativeXLM));
}

#[test]
fn test_create_sale_with_native_xlm() {
    let (env, cid, client, admin) = new_env();
    let asset = Asset::NativeXLM;
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert_eq!(id, 1u64);
}

#[test]
fn test_create_auction_with_native_xlm() {
    let (env, cid, client, _admin) = new_env();
    let asset = Asset::NativeXLM;
    let seller = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let id = client.create_auction(
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
    assert_eq!(id, 1u64);
}

#[test]
fn test_place_bid_native_xlm() {
    let (env, cid, client, _admin) = new_env();
    let asset = Asset::NativeXLM;
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = env.register(MockNft, ());
    let creator = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &_admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);
    let sac = client.get_native_xlm_sac().unwrap();
    token::StellarAssetClient::new(&env, &sac).mint(&bidder, &100_000i128);
    let id = client.create_auction(
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
    client.place_bid(&id, &bidder, &100_000i128, &None);
    let auction = client.get_auction(&id);
    assert_eq!(auction.highest_bid, 100_000i128);
}

#[test]
fn test_get_token_balance_native_xlm_succeeds() {
    let (env, cid, client, _admin) = new_env();
    let user = Address::generate(&env);
    let sac = client.get_native_xlm_sac().unwrap();
    token::StellarAssetClient::new(&env, &sac).mint(&user, &100_000_000i128);
    env.as_contract(&cid, || {
        let balance =
            crate::utils::asset_utils::get_token_balance(&Asset::NativeXLM, &user, &env).unwrap();
        assert_eq!(balance, 100_000_000);
    });
}

#[test]
fn test_native_asset_requires_configured_sac() {
    let env = Env::default();
    env.mock_all_auths();
    let cid = env.register(MarketplaceSettlement, ());
    let client = MarketplaceSettlementClient::new(&env, &cid);
    let admin = Address::generate(&env);
    client.initialize(&admin, &default_fee_config(&env, admin.clone()), &None);

    env.as_contract(&cid, || {
        let supported = soroban_sdk::Vec::new(&env);
        assert_eq!(
            crate::utils::asset_utils::validate_asset(&Asset::NativeXLM, &supported, &env,),
            Err(SettlementError::NativeAssetTransferFailed)
        );
        let account = Address::generate(&env);
        assert_eq!(
            crate::utils::asset_utils::get_token_balance(&Asset::NativeXLM, &account, &env),
            Err(SettlementError::NativeAssetBalanceFailed)
        );
    });
}

#[test]
fn test_asset_decimals_dispatches_for_native_and_tokens() {
    let env = Env::default();
    let token_asset = mk_asset(&env);
    assert_eq!(
        crate::utils::asset_utils::get_token_decimals(&Asset::NativeXLM, &env),
        Ok(7)
    );
    assert_eq!(
        crate::utils::asset_utils::get_token_decimals(&token_asset, &env),
        Ok(7)
    );
}

#[test]
fn test_native_transfer_failure_returns_contract_error() {
    let (env, cid, _client, _admin) = new_env();
    let empty = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.as_contract(&cid, || {
        assert_eq!(
            crate::utils::asset_utils::transfer_tokens(
                &Asset::NativeXLM,
                &empty,
                &recipient,
                1,
                &env,
            ),
            Err(SettlementError::NativeAssetTransferFailed)
        );
    });
}

#[test]
fn test_execute_sale_with_native_xlm_distributes_proceeds_and_fees() {
    let (env, cid, client, admin) = new_env();
    let asset = Asset::NativeXLM;
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let creator = Address::generate(&env);
    let nft = env.register(MockNft, ());
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

    let sac = client.get_native_xlm_sac().unwrap();
    let sac_admin = token::StellarAssetClient::new(&env, &sac);
    let balances = token::Client::new(&env, &sac);
    sac_admin.mint(&buyer, &1_000_000i128);

    let id = client.create_sale(&seller, &nft, &1u64, &1_000_000i128, &asset, &86400u64);
    assert_eq!(MockNftClient::new(&env, &nft).owner_of(&1), cid);

    let result = client.execute_sale(&id, &buyer, &1_000_000i128);
    assert!(result.success);
    assert_eq!(MockNftClient::new(&env, &nft).owner_of(&1), buyer);
    assert_eq!(balances.balance(&buyer), 0);
    assert_eq!(balances.balance(&creator), 50_000);
    assert_eq!(balances.balance(&seller), 925_000);
    assert_eq!(balances.balance(&cid), 25_000);
    assert_eq!(client.get_accumulated_fees(&asset), 25_000);

    assert_eq!(
        client.withdraw_platform_fees(&asset, &admin, &admin),
        25_000
    );
    assert_eq!(balances.balance(&cid), 0);
    assert_eq!(balances.balance(&admin), 25_000);
}

#[test]
fn test_native_xlm_auction_refunds_outbid_bidder_and_settles() {
    let (env, cid, client, admin) = new_env();
    let asset = Asset::NativeXLM;
    let seller = Address::generate(&env);
    let bidder_one = Address::generate(&env);
    let bidder_two = Address::generate(&env);
    let creator = Address::generate(&env);
    let nft = env.register(MockNft, ());
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    MockNftClient::new(&env, &nft).set_owner(&seller);

    let sac = client.get_native_xlm_sac().unwrap();
    let sac_admin = token::StellarAssetClient::new(&env, &sac);
    let balances = token::Client::new(&env, &sac);
    sac_admin.mint(&bidder_one, &100_000i128);
    sac_admin.mint(&bidder_two, &110_000i128);

    let id = client.create_auction(
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
    client.place_bid(&id, &bidder_one, &100_000i128, &None);
    client.place_bid(&id, &bidder_two, &110_000i128, &None);
    assert_eq!(balances.balance(&bidder_one), 100_000);
    assert_eq!(balances.balance(&cid), 110_000);

    env.ledger().set_timestamp(3601);
    client.end_auction(&id, &seller);

    assert_eq!(MockNftClient::new(&env, &nft).owner_of(&1), bidder_two);
    assert_eq!(balances.balance(&bidder_two), 0);
    assert_eq!(balances.balance(&creator), 5_500);
    assert_eq!(balances.balance(&seller), 101_750);
    assert_eq!(balances.balance(&cid), 2_750);
    assert_eq!(client.get_accumulated_fees(&asset), 2_750);
}

#[test]
fn test_bundle_creation_with_native_xlm() {
    use crate::types::{NFTItem, RoyaltyDistribution};
    let (env, cid, client, admin) = new_env();
    let asset = Asset::NativeXLM;
    let seller = Address::generate(&env);
    let creator = Address::generate(&env);
    let nft = Address::generate(&env);
    reg(&env, &cid, &nft, &creator, &admin, &asset);
    client.add_supported_asset(&admin, &asset);
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
        nft_address: nft,
        token_id: 1,
        royalty_info: dummy,
    });
    let id = client.create_bundle(&seller, &items, &500_000i128, &asset, &86400u64);
    assert!(id > 0);
}

#[test]
fn test_assets_not_equal_xlm_and_token() {
    use crate::utils::asset_utils::assets_equal;
    let env = Env::default();
    let contract = env.register(MockToken, ());
    let token_asset = Asset::Token(crate::types::TokenAsset {
        contract,
        symbol: soroban_sdk::Symbol::new(&env, "XLM"),
    });
    assert!(!assets_equal(&Asset::NativeXLM, &token_asset));
}

#[test]
fn test_xlm_payment_failed_error() {
    let err = SettlementError::NativeAssetTransferFailed;
    assert_eq!(err as u32, 304);
    let err2 = SettlementError::NativeAssetBalanceFailed;
    assert_eq!(err2 as u32, 305);
}

// ---------------------------------------------------------------------------
// Withdrawal anomaly monitoring (issue #554)
// ---------------------------------------------------------------------------
//
// These cover both sides of the criteria: a normal withdrawal pattern must not
// be flagged, and constructed anomalous patterns must be detected and handled.
//
// Soroban only allows storage access from inside a contract frame, so every
// monitor call is wrapped in `env.as_contract` (see the helpers below).
mod withdrawal_anomaly_tests {
    use super::*;
    use crate::error::WithdrawalAnomalyError;
    use crate::security::frontrun_protection::{
        WithdrawalAnomalyConfig, WithdrawalAnomalyDecision, WithdrawalAnomalyKind,
        WithdrawalHistory, WithdrawalHold, WithdrawalPatternMonitor,
    };

    const CHANNEL: &str = "withdraw_losing_bid";

    /// `(env, contract_id, user)`, with the monitor's storage reachable through
    /// `contract_id`.
    fn monitor_env() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(MarketplaceSettlement, ());
        let user = Address::generate(&env);
        (env, contract_id, user)
    }

    fn monitor(
        env: &Env,
        contract_id: &Address,
        user: &Address,
        amount: i128,
    ) -> WithdrawalAnomalyDecision {
        env.as_contract(contract_id, || {
            WithdrawalPatternMonitor::monitor_withdrawal(env, user, amount, CHANNEL).unwrap()
        })
    }

    fn preflight(
        env: &Env,
        contract_id: &Address,
        user: &Address,
        amount: i128,
    ) -> WithdrawalAnomalyDecision {
        env.as_contract(contract_id, || {
            WithdrawalPatternMonitor::check_unusual_pattern(env, user, amount).unwrap()
        })
    }

    fn is_held(env: &Env, contract_id: &Address, user: &Address) -> bool {
        env.as_contract(contract_id, || WithdrawalPatternMonitor::is_held(env, user))
    }

    fn hold_of(env: &Env, contract_id: &Address, user: &Address) -> Option<WithdrawalHold> {
        env.as_contract(contract_id, || {
            WithdrawalPatternMonitor::get_hold(env, user)
        })
    }

    fn history_of(env: &Env, contract_id: &Address, user: &Address) -> WithdrawalHistory {
        env.as_contract(contract_id, || {
            WithdrawalPatternMonitor::get_history(env, user)
        })
    }

    fn clear(
        env: &Env,
        contract_id: &Address,
        user: &Address,
    ) -> Result<(), WithdrawalAnomalyError> {
        env.as_contract(contract_id, || {
            WithdrawalPatternMonitor::clear_hold(env, user)
        })
    }

    fn configure(
        env: &Env,
        contract_id: &Address,
        config: WithdrawalAnomalyConfig,
    ) -> Result<(), WithdrawalAnomalyError> {
        env.as_contract(contract_id, || {
            WithdrawalPatternMonitor::set_config(env, config)
        })
    }

    fn config_of(env: &Env, contract_id: &Address) -> WithdrawalAnomalyConfig {
        env.as_contract(contract_id, || WithdrawalPatternMonitor::get_config(env))
    }

    #[test]
    fn test_withdrawal_monitor_allows_normal_pattern() {
        let (env, contract_id, user) = monitor_env();

        // One withdrawal per day, identical amounts: never more than one
        // withdrawal inside the velocity window, never rapid, never a spike.
        let mut now = 86_400u64;
        for _ in 0..6 {
            env.ledger().set_timestamp(now);
            assert_eq!(
                monitor(&env, &contract_id, &user, 1_000),
                WithdrawalAnomalyDecision::Allowed
            );
            now += 86_400;
        }

        assert!(!is_held(&env, &contract_id, &user));
        assert!(hold_of(&env, &contract_id, &user).is_none());

        let history = history_of(&env, &contract_id, &user);
        assert_eq!(history.total_withdrawals, 6);
        assert_eq!(history.timestamps.len(), 6);
    }

    #[test]
    fn test_withdrawal_monitor_holds_velocity_anomaly() {
        let (env, contract_id, user) = monitor_env();

        // Default max_withdrawals_per_window is 5. Space them wider than the
        // 5s minimum gap so velocity, not rapidity, is what trips the check.
        let mut now = 1_000u64;
        for _ in 0..5 {
            env.ledger().set_timestamp(now);
            assert_eq!(
                monitor(&env, &contract_id, &user, 100),
                WithdrawalAnomalyDecision::Allowed
            );
            now += 10;
        }

        env.ledger().set_timestamp(now);
        assert_eq!(
            monitor(&env, &contract_id, &user, 100),
            WithdrawalAnomalyDecision::Held(WithdrawalAnomalyKind::Velocity)
        );
        assert!(is_held(&env, &contract_id, &user));

        let hold = hold_of(&env, &contract_id, &user).unwrap();
        assert_eq!(hold.reason, WithdrawalAnomalyKind::Velocity);
        assert_eq!(hold.amount, 100);
    }

    #[test]
    fn test_withdrawal_monitor_holds_rapid_sequence_anomaly() {
        let (env, contract_id, user) = monitor_env();

        env.ledger().set_timestamp(10_000);
        assert_eq!(
            monitor(&env, &contract_id, &user, 100),
            WithdrawalAnomalyDecision::Allowed
        );

        // One second later: far faster than the 5s minimum spacing.
        env.ledger().set_timestamp(10_001);
        assert_eq!(
            monitor(&env, &contract_id, &user, 100),
            WithdrawalAnomalyDecision::Held(WithdrawalAnomalyKind::RapidSequence)
        );
        assert!(is_held(&env, &contract_id, &user));
    }

    #[test]
    fn test_withdrawal_monitor_flags_amount_spike_without_holding() {
        let (env, contract_id, user) = monitor_env();

        // Build a clean history of three small withdrawals.
        let mut now = 1_000u64;
        for _ in 0..3 {
            env.ledger().set_timestamp(now);
            assert_eq!(
                monitor(&env, &contract_id, &user, 100),
                WithdrawalAnomalyDecision::Allowed
            );
            now += 1_000;
        }

        // Average is 100 and the default multiplier is 10x, so the threshold is
        // 1_000; 50_000 is above both the ratio and the absolute floor.
        env.ledger().set_timestamp(now);
        assert_eq!(
            monitor(&env, &contract_id, &user, 50_000),
            WithdrawalAnomalyDecision::Flagged(WithdrawalAnomalyKind::AmountSpike)
        );
        // Flagged, not blocked: the withdrawal may still proceed.
        assert!(!is_held(&env, &contract_id, &user));
    }

    #[test]
    fn test_withdrawal_monitor_ignores_dust_spike_below_floor() {
        let (env, contract_id, user) = monitor_env();

        let mut now = 1_000u64;
        for _ in 0..3 {
            env.ledger().set_timestamp(now);
            assert_eq!(
                monitor(&env, &contract_id, &user, 1),
                WithdrawalAnomalyDecision::Allowed
            );
            now += 1_000;
        }

        // 100x the average of 1, but far below min_spike_amount (1_000), so it is
        // not worth flagging.
        env.ledger().set_timestamp(now);
        assert_eq!(
            monitor(&env, &contract_id, &user, 100),
            WithdrawalAnomalyDecision::Allowed
        );
    }

    #[test]
    fn test_withdrawal_hold_persists_until_cleared_by_an_operator() {
        let (env, contract_id, user) = monitor_env();

        // Rapid sequence raises a hold.
        env.ledger().set_timestamp(10_000);
        monitor(&env, &contract_id, &user, 100);
        env.ledger().set_timestamp(10_001);
        monitor(&env, &contract_id, &user, 100);
        assert!(is_held(&env, &contract_id, &user));

        // A later, well-spaced, small withdrawal is still refused: the account
        // stays held until an operator clears it.
        env.ledger().set_timestamp(1_000_000);
        assert!(matches!(
            monitor(&env, &contract_id, &user, 100),
            WithdrawalAnomalyDecision::Held(_)
        ));
        assert!(matches!(
            preflight(&env, &contract_id, &user, 100),
            WithdrawalAnomalyDecision::Held(_)
        ));

        // Refused attempts are not recorded (the withdrawal never happened).
        assert_eq!(history_of(&env, &contract_id, &user).total_withdrawals, 2);

        assert_eq!(clear(&env, &contract_id, &user), Ok(()));
        assert!(!is_held(&env, &contract_id, &user));
        // History is retained for auditors even after the hold is lifted.
        assert_eq!(history_of(&env, &contract_id, &user).total_withdrawals, 2);
        // Clearing a hold that does not exist is an error.
        assert_eq!(
            clear(&env, &contract_id, &user),
            Err(WithdrawalAnomalyError::NoHold)
        );
    }

    #[test]
    fn test_withdrawal_anomaly_config_validation_and_application() {
        let (env, contract_id, _user) = monitor_env();

        assert_eq!(
            configure(
                &env,
                &contract_id,
                WithdrawalAnomalyConfig {
                    window_seconds: 0,
                    ..WithdrawalAnomalyConfig::default()
                }
            ),
            Err(WithdrawalAnomalyError::InvalidConfig)
        );

        assert_eq!(
            configure(
                &env,
                &contract_id,
                WithdrawalAnomalyConfig {
                    min_spike_amount: -1,
                    ..WithdrawalAnomalyConfig::default()
                }
            ),
            Err(WithdrawalAnomalyError::InvalidConfig)
        );

        // A retention shorter than the velocity window would silently disable
        // velocity detection, so it is rejected too.
        assert_eq!(
            configure(
                &env,
                &contract_id,
                WithdrawalAnomalyConfig {
                    max_withdrawals_per_window: 5,
                    history_limit: 2,
                    ..WithdrawalAnomalyConfig::default()
                }
            ),
            Err(WithdrawalAnomalyError::InvalidConfig)
        );

        // Detection is active with defaults before an admin configures anything.
        assert_eq!(
            config_of(&env, &contract_id),
            WithdrawalAnomalyConfig::default()
        );

        let strict = WithdrawalAnomalyConfig {
            window_seconds: 60,
            max_withdrawals_per_window: 2,
            min_withdrawal_gap_seconds: 1,
            spike_multiplier: 100,
            min_spike_amount: 1_000_000,
            min_history_for_spike: 5,
            history_limit: 4,
        };
        assert_eq!(configure(&env, &contract_id, strict.clone()), Ok(()));
        assert_eq!(config_of(&env, &contract_id), strict);
    }

    #[test]
    fn test_withdrawal_history_respects_configured_limit() {
        let (env, contract_id, user) = monitor_env();

        assert_eq!(
            configure(
                &env,
                &contract_id,
                WithdrawalAnomalyConfig {
                    max_withdrawals_per_window: 2,
                    min_withdrawal_gap_seconds: 1,
                    history_limit: 2,
                    ..WithdrawalAnomalyConfig::default()
                }
            ),
            Ok(())
        );

        let mut now = 100_000u64;
        for _ in 0..4 {
            env.ledger().set_timestamp(now);
            monitor(&env, &contract_id, &user, 10);
            now += 10_000;
        }

        let history = history_of(&env, &contract_id, &user);
        assert_eq!(history.timestamps.len(), 2);
        assert_eq!(history.amounts.len(), 2);
        // Totals keep counting even though only the recent window is retained.
        assert_eq!(history.total_withdrawals, 4);
        assert_eq!(history.total_amount, 40);
    }
}
