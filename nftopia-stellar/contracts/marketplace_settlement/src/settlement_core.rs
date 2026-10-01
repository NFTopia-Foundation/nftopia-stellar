use crate::atomic_swap::AtomicSwapEngine;
use crate::auction_engine::AuctionEngine;
use crate::dispute_resolution::DisputeResolutionManager;
use crate::error::SettlementError;
use crate::events::{
    emit_address_blocked, emit_address_unblocked, AddressBlockedEvent, AddressUnblockedEvent,
};
use crate::fee_manager::FeeManager;
use crate::pause_manager::{ModuleType, PauseManager};
use crate::royalty_distributor::RoyaltyDistributor;
use crate::security::reentrancy_guard::ReentrancyGuard;
use crate::storage::{
    allowlist_store::AllowlistStore,
    auction_store::AuctionStore,
    blocklist_store::BlocklistStore,
    transaction_store::{BundleTransactionStore, SaleTransactionStore, TradeTransactionStore},
};
use crate::types::{
    AdminConfig, Asset, AuctionTransaction, AuctionType, BundleTransaction, ExecutionResult,
    FeeConfig, SaleTransaction, SwapTimeoutConfig, TokenAsset, TradeTransaction,
};
use crate::utils::{asset_utils, time_utils};
use crate::version;
use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, Bytes, BytesN, Env, String, Symbol, Vec,
};

use crate::dispute_resolution::{ArbitrationOracle, DisputeConfig};
use crate::types::Dispute;

/// Marketplace Settlement Contract
#[contract]
pub struct MarketplaceSettlement;

/// Implementation of the Marketplace Settlement Contract
#[allow(clippy::too_many_arguments)]
#[contractimpl]
impl MarketplaceSettlement {
    // === HELPER FUNCTIONS ===

    fn supported_assets_key(env: &Env) -> Symbol {
        Symbol::new(env, "supported_assets")
    }

    // === INITIALIZATION ===

    /// Initialize the contract with admin configuration and explicit fee parameters.
    ///
    /// `fee_config` must be provided with deployment-appropriate values; there
    /// are no hardcoded defaults. This function can be called exactly once —
    /// any subsequent call returns `FeeAlreadyInitialized`.
    ///
    /// `swap_timeout_config` sets the atomic swap timeout policy up front; passing
    /// `None` applies the conservative mainnet defaults from
    /// [`SwapTimeoutConfig::defaults`], which an admin can change later via
    /// `update_swap_timeout_config`.
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_config: FeeConfig,
        swap_timeout_config: Option<SwapTimeoutConfig>,
    ) -> Result<(), SettlementError> {
        let admin_config = AdminConfig {
            admin: admin.clone(),
            emergency_withdrawal_enabled: true,
            max_transaction_duration: 2592000, // 30 days
            max_auction_duration: 604800,      // 7 days
            min_bid_increment_bps: 100,        // 1%
            max_royalty_percentage: 5000,      // 50%
            dispute_cooling_period: 86400,     // 24 hours
            arbitration_quorum: 3,
        };

        env.storage()
            .instance()
            .set(&symbol_short!("admin_cfg"), &admin_config);

        // Validate and store the caller-supplied fee configuration exactly once.
        FeeManager::initialize_fee_config(&env, &fee_config, &admin)?;

        // Set default auction config
        let auction_config = crate::auction_engine::AuctionConfig::default();
        AuctionEngine::update_auction_config(&env, &auction_config, &admin)?;

        // Set default dispute config
        let dispute_config = crate::dispute_resolution::DisputeConfig::default();
        DisputeResolutionManager::update_dispute_config(&env, &dispute_config, &admin)?;

        // Set atomic swap timeout policy
        let swap_config = swap_timeout_config.unwrap_or_else(SwapTimeoutConfig::defaults);
        AtomicSwapEngine::set_timeout_config(&env, &swap_config, &admin)?;

        // Initialize with empty supported assets list
        let empty_assets: Vec<Asset> = Vec::new(&env);
        env.storage()
            .persistent()
            .set(&Self::supported_assets_key(&env), &empty_assets);

        Ok(())
    }

    // === ASSET WHITELIST FUNCTIONS ===

    /// Get the list of supported assets (view function)
    pub fn get_supported_assets(env: Env) -> Vec<Asset> {
        env.storage()
            .persistent()
            .get(&Self::supported_assets_key(&env))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Add a supported asset (admin only)
    pub fn add_supported_asset(
        env: Env,
        admin: Address,
        asset: Asset,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        // Check admin permissions
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        let supported = Self::get_supported_assets(env.clone());

        // Check if asset already exists
        for i in 0..supported.len() {
            if asset_utils::assets_equal(&asset, &supported.get(i).unwrap()) {
                return Err(SettlementError::AlreadyExists);
            }
        }

        let mut new_list = supported;
        new_list.push_back(asset);
        env.storage()
            .persistent()
            .set(&Self::supported_assets_key(&env), &new_list);

        Ok(())
    }

    /// Remove a supported asset (admin only)
    pub fn remove_supported_asset(
        env: Env,
        admin: Address,
        asset: Asset,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        // Check admin permissions
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        let supported = Self::get_supported_assets(env.clone());

        let mut found = false;
        let mut new_list: Vec<Asset> = Vec::new(&env);
        for i in 0..supported.len() {
            let existing = supported.get(i).unwrap();
            if asset_utils::assets_equal(&asset, &existing) {
                found = true;
            } else {
                new_list.push_back(existing);
            }
        }

        if !found {
            return Err(SettlementError::NotFound);
        }

        env.storage()
            .persistent()
            .set(&Self::supported_assets_key(&env), &new_list);

        Ok(())
    }

    // === PAUSE FUNCTIONS ===

    /// Pause the contract (admin only) - emergency circuit breaker
    pub fn pause_contract(
        env: Env,
        admin: Address,
        reason: Option<Bytes>,
        modules: Option<Vec<Symbol>>,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        PauseManager::pause(&env, &admin, reason, modules)
    }

    /// Unpause the contract (admin only)
    pub fn unpause_contract(
        env: Env,
        admin: Address,
        reason: Option<Bytes>,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        PauseManager::unpause(&env, &admin, reason)
    }

    /// Schedule a pause with timelock (admin only)
    pub fn schedule_pause(
        env: Env,
        admin: Address,
        delay_seconds: u64,
        modules: Vec<Symbol>,
        reason: Bytes,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        PauseManager::schedule_pause(&env, &admin, delay_seconds, modules, reason)
    }

    /// Cancel scheduled pause (admin only)
    pub fn cancel_scheduled_pause(env: Env, admin: Address) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        PauseManager::cancel_scheduled_pause(&env, &admin)
    }

    /// Execute scheduled pause (admin only)
    pub fn execute_scheduled_pause(env: Env, admin: Address) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        PauseManager::execute_scheduled_pause(&env, &admin)
    }

    /// Check if contract is paused (view function)
    pub fn is_paused(env: Env) -> bool {
        PauseManager::is_paused(&env)
    }

    /// Check if module is paused (view function)
    pub fn is_module_paused(env: Env, module: Symbol) -> bool {
        let module_type = if module == Symbol::new(&env, "sales") {
            ModuleType::Sales
        } else if module == Symbol::new(&env, "auctions") {
            ModuleType::Auctions
        } else if module == Symbol::new(&env, "trades") {
            ModuleType::Trades
        } else if module == Symbol::new(&env, "bundles") {
            ModuleType::Bundles
        } else if module == Symbol::new(&env, "disputes") {
            ModuleType::Disputes
        } else if module == Symbol::new(&env, "withdrawals") {
            ModuleType::Withdrawals
        } else {
            ModuleType::All
        };
        PauseManager::is_module_paused(&env, module_type)
    }

    /// Get pause state (view function)
    pub fn get_pause_state(
        env: Env,
    ) -> (
        bool,
        Option<u64>,
        Option<Address>,
        Option<Bytes>,
        Vec<Symbol>,
    ) {
        if let Some(info) = PauseManager::get_pause_info(&env) {
            return (
                info.paused,
                Some(info.paused_at),
                Some(info.paused_by),
                info.reason,
                info.modules_paused,
            );
        }
        (false, None, None, None, Vec::new(&env))
    }

    /// Get scheduled pause info (view function)
    pub fn get_scheduled_pause_info(env: Env) -> Option<(u64, u64, Vec<Symbol>, Bytes, Address)> {
        if let Some(scheduled) = PauseManager::get_scheduled_pause(&env) {
            return Some((
                scheduled.scheduled_at,
                scheduled.execution_at,
                scheduled.modules,
                scheduled.reason,
                scheduled.scheduled_by,
            ));
        }
        None
    }

    /// Check if timelock is active (view function)
    pub fn is_timelock_active(env: Env) -> bool {
        PauseManager::is_timelock_active(&env)
    }

    /// Get time until timelock executes (view function)
    pub fn get_timelock_remaining(env: Env) -> Option<u64> {
        PauseManager::get_timelock_remaining(&env)
    }

    /// Get paused modules (view function)
    pub fn get_paused_modules(env: Env) -> Vec<Symbol> {
        PauseManager::get_paused_modules(&env)
    }

    // === TRANSACTION FUNCTIONS ===

    /// Create a fixed-price sale
    pub fn create_sale(
        env: Env,
        seller: Address,
        nft_address: Address,
        token_id: u64,
        price: i128,
        currency: Asset,
        duration_seconds: u64,
    ) -> Result<u64, SettlementError> {
        seller.require_auth();

        // Check if sales module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Sales)?;

        // Check if seller is blocked
        if BlocklistStore::is_blocked(&env, &seller) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &seller, "create_sale", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &seller,
                &Symbol::new(&env, "create_sale"),
            )?;

            // Get supported assets from storage
            let supported_assets = Self::get_supported_assets(env.clone());

            // Validate inputs
            asset_utils::validate_asset(&currency, &supported_assets, &env)?;
            asset_utils::validate_nft_contract(&nft_address, &env)?;
            time_utils::validate_transaction_timing(
                env.ledger().timestamp(),
                env.ledger().timestamp() + duration_seconds,
                2592000, // 30 days max
                &env,
            )?;

            // Check NFT ownership
            if !asset_utils::check_nft_ownership(&nft_address, token_id, &seller, &env)? {
                return Err(SettlementError::Unauthorized);
            }

            let fee_config = FeeManager::get_fee_config(&env)?;
            let platform_fee = FeeManager::calculate_fee(&env, price, &seller)?;

            // Calculate royalties after reserving the configured platform fee.
            let royalty_distribution = RoyaltyDistributor::calculate_royalties(
                &env,
                &nft_address,
                token_id,
                price,
                platform_fee,
                &seller,
                &fee_config.fee_recipient,
            )?;

            let transaction_id = SaleTransactionStore::next_id(&env);

            let sale = SaleTransaction {
                transaction_id,
                seller: seller.clone(),
                buyer: None,
                nft_address: nft_address.clone(),
                token_id,
                price,
                currency: currency.clone(),
                state: crate::types::TransactionState::Pending,
                created_at: env.ledger().timestamp(),
                expires_at: env.ledger().timestamp() + duration_seconds,
                escrow_address: env.current_contract_address(),
                royalty_info: royalty_distribution,
                platform_fee,
            };

            SaleTransactionStore::put(&env, &sale)?;

            // Initialize atomic swap, expiring in step with the sale itself
            AtomicSwapEngine::initialize_swap(
                &env,
                transaction_id,
                &seller,
                &seller, // Placeholder buyer
                &nft_address,
                token_id,
                &currency,
                price,
                duration_seconds,
            )?;

            let nft_asset = Asset::Token(TokenAsset {
                contract: nft_address,
                symbol: Symbol::new(&env, "NFT"),
            });
            AtomicSwapEngine::deposit_to_escrow(
                &env,
                transaction_id,
                &seller,
                &nft_asset,
                token_id as i128,
                true,
            )?;

            Ok(transaction_id)
        })
    }

    /// Execute a sale
    pub fn execute_sale(
        env: Env,
        transaction_id: u64,
        buyer: Address,
        payment_amount: i128,
    ) -> Result<ExecutionResult, SettlementError> {
        buyer.require_auth();

        // Check if sales module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Sales)?;

        // Check if buyer is blocked
        if BlocklistStore::is_blocked(&env, &buyer) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &buyer, "execute_sale", || {
            let mut sale = SaleTransactionStore::get(&env, transaction_id)?;

            // Validate sale state
            if sale.state != crate::types::TransactionState::Pending {
                return Err(SettlementError::InvalidState);
            }

            // Check expiration
            if time_utils::is_expired(sale.expires_at, &env) {
                return Err(SettlementError::Expired);
            }

            // Validate payment
            if payment_amount != sale.price {
                return Err(SettlementError::InvalidAmount);
            }

            // Update sale with buyer
            sale.buyer = Some(buyer.clone());
            sale.state = crate::types::TransactionState::Funded;
            SaleTransactionStore::update(&env, &sale)?;

            // Execute atomic swap
            AtomicSwapEngine::execute_sale_swap(&env, transaction_id, &buyer)?;

            // Distribute royalties and fees
            let distribution_result = RoyaltyDistributor::distribute_royalties(
                &env,
                transaction_id,
                &sale.royalty_info,
                &sale.currency,
                sale.platform_fee,
            )?;

            // Collect platform fee
            FeeManager::collect_platform_fee(
                &env,
                distribution_result.platform_amount,
                &sale.currency,
                &buyer,
            )?;

            // Update final state
            sale.state = crate::types::TransactionState::Executed;
            SaleTransactionStore::update(&env, &sale)?;

            Ok(ExecutionResult {
                transaction_id,
                success: true,
                transferred_nft: true,
                transferred_payment: true,
                distributed_royalties: distribution_result.distribution_success,
                collected_platform_fee: true,
                timestamp: env.ledger().timestamp(),
            })
        })
    }

    /// Create an auction
    pub fn create_auction(
        env: Env,
        seller: Address,
        nft_address: Address,
        token_id: u64,
        starting_price: i128,
        reserve_price: i128,
        duration_seconds: u64,
        bid_increment: i128,
        auction_type: AuctionType,
        currency: Asset,
    ) -> Result<u64, SettlementError> {
        seller.require_auth();

        // Check if auctions module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Auctions)?;

        // Check if seller is blocked
        if BlocklistStore::is_blocked(&env, &seller) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &seller, "create_auction", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &seller,
                &Symbol::new(&env, "create_auction"),
            )?;

            // Get supported assets from storage
            let supported_assets = Self::get_supported_assets(env.clone());

            // Validate asset
            asset_utils::validate_asset(&currency, &supported_assets, &env)?;
            asset_utils::validate_nft_contract(&nft_address, &env)?;
            if !asset_utils::check_nft_ownership(&nft_address, token_id, &seller, &env)? {
                return Err(SettlementError::Unauthorized);
            }

            AuctionEngine::create_auction(
                &env,
                auction_type,
                &seller,
                &nft_address,
                token_id,
                starting_price,
                reserve_price,
                duration_seconds,
                bid_increment,
                &currency,
            )
        })
    }

    /// Place a bid on an auction
    pub fn place_bid(
        env: Env,
        auction_id: u64,
        bidder: Address,
        bid_amount: i128,
        commitment_hash: Option<Bytes>,
    ) -> Result<(), SettlementError> {
        bidder.require_auth();

        // Check if auctions module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Auctions)?;

        // Check if bidder is blocked
        if BlocklistStore::is_blocked(&env, &bidder) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &bidder, "place_bid", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &bidder,
                &Symbol::new(&env, "place_bid"),
            )?;

            AuctionEngine::place_bid(&env, auction_id, &bidder, bid_amount, commitment_hash)
        })
    }

    /// Reveal a committed bid
    pub fn reveal_bid(
        env: Env,
        auction_id: u64,
        bidder: Address,
        bid_amount: i128,
        salt: Bytes,
    ) -> Result<(), SettlementError> {
        bidder.require_auth();

        // Check if auctions module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Auctions)?;

        // Check if bidder is blocked
        if BlocklistStore::is_blocked(&env, &bidder) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &bidder, "reveal_bid", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &bidder,
                &Symbol::new(&env, "reveal_bid"),
            )?;

            AuctionEngine::reveal_bid(&env, auction_id, &bidder, bid_amount, &salt)
        })
    }

    /// End an auction
    pub fn end_auction(env: Env, auction_id: u64, caller: Address) -> Result<(), SettlementError> {
        caller.require_auth();

        // Check if auctions module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Auctions)?;

        ReentrancyGuard::execute(&env, &caller, "end_auction", || {
            AuctionEngine::end_auction(&env, auction_id, &caller)
        })
    }

    /// Cancel an auction with refund (when bids exist)
    pub fn cancel_auction_with_refund(
        env: Env,
        auction_id: u64,
        canceller: Address,
    ) -> Result<(), SettlementError> {
        canceller.require_auth();

        // Check if auctions module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Auctions)?;

        ReentrancyGuard::execute(&env, &canceller, "cancel_auction_with_refund", || {
            AuctionEngine::cancel_auction_with_refund(&env, auction_id, &canceller)
        })
    }

    /// Withdraw a losing bid after auction reaches terminal state
    pub fn withdraw_losing_bid(
        env: Env,
        auction_id: u64,
        bidder: Address,
    ) -> Result<(), SettlementError> {
        bidder.require_auth();

        // Check if auctions module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Auctions)?;

        ReentrancyGuard::execute(&env, &bidder, "withdraw_losing_bid", || {
            AuctionEngine::withdraw_losing_bid(&env, auction_id, &bidder)
        })
    }

    /// Create a trade
    pub fn create_trade(
        env: Env,
        initiator: Address,
        counterparty: Option<Address>,
        initiator_nfts: Vec<crate::types::NFTItem>,
        counterparty_nfts: Vec<crate::types::NFTItem>,
        duration_seconds: u64,
    ) -> Result<u64, SettlementError> {
        initiator.require_auth();

        // Check if trades module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Trades)?;

        // Check if initiator is blocked
        if BlocklistStore::is_blocked(&env, &initiator) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &initiator, "create_trade", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &initiator,
                &Symbol::new(&env, "create_trade"),
            )?;

            // Validate trade parameters
            if initiator_nfts.is_empty() {
                return Err(SettlementError::InvalidAmount);
            }

            let trade_id = TradeTransactionStore::next_id(&env);

            let trade = TradeTransaction {
                trade_id,
                initiator: initiator.clone(),
                counterparty,
                initiator_nfts,
                counterparty_nfts,
                state: crate::types::TransactionState::Pending,
                created_at: env.ledger().timestamp(),
                expires_at: env.ledger().timestamp() + duration_seconds,
                platform_fee: 0, // Would be calculated
            };

            TradeTransactionStore::put(&env, &trade)?;
            Ok(trade_id)
        })
    }

    /// Accept a trade
    pub fn accept_trade(env: Env, trade_id: u64, acceptor: Address) -> Result<(), SettlementError> {
        acceptor.require_auth();

        // Check if trades module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Trades)?;

        // Check if acceptor is blocked
        if BlocklistStore::is_blocked(&env, &acceptor) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &acceptor.clone(), "accept_trade", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &acceptor,
                &Symbol::new(&env, "accept_trade"),
            )?;

            let mut trade = TradeTransactionStore::get(&env, trade_id)?;

            if trade.state != crate::types::TransactionState::Pending {
                return Err(SettlementError::InvalidState);
            }

            if time_utils::is_expired(trade.expires_at, &env) {
                return Err(SettlementError::Expired);
            }

            trade.counterparty = Some(acceptor);
            trade.state = crate::types::TransactionState::Funded;
            TradeTransactionStore::update(&env, &trade)?;

            Ok(())
        })
    }

    /// Execute a trade
    pub fn execute_trade(
        env: Env,
        trade_id: u64,
        executor: Address,
    ) -> Result<(), SettlementError> {
        executor.require_auth();

        // Check if trades module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Trades)?;

        // Check if executor is blocked
        if BlocklistStore::is_blocked(&env, &executor) {
            return Err(SettlementError::AddressBlocked);
        }

        ReentrancyGuard::execute(&env, &executor, "execute_trade", || {
            crate::security::rate_limiter::RateLimiter::check_rate_limit(
                &env,
                &executor,
                &Symbol::new(&env, "execute_trade"),
            )?;

            let mut trade = TradeTransactionStore::get(&env, trade_id)?;

            if trade.state != crate::types::TransactionState::Funded {
                return Err(SettlementError::InvalidState);
            }

            // Execute NFT swaps
            // This is a simplified implementation
            trade.state = crate::types::TransactionState::Executed;
            TradeTransactionStore::update(&env, &trade)?;

            Ok(())
        })
    }

    /// Create a bundle sale
    pub fn create_bundle(
        env: Env,
        seller: Address,
        items: Vec<crate::types::NFTItem>,
        total_price: i128,
        currency: Asset,
        duration_seconds: u64,
    ) -> Result<u64, SettlementError> {
        seller.require_auth();

        // Check if bundles module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Bundles)?;

        ReentrancyGuard::execute(&env, &seller, "create_bundle", || {
            if items.is_empty() {
                return Err(SettlementError::InvalidAmount);
            }

            // Get supported assets from storage
            let supported_assets = Self::get_supported_assets(env.clone());

            // Validate asset
            asset_utils::validate_asset(&currency, &supported_assets, &env)?;

            let bundle_id = BundleTransactionStore::next_id(&env);

            let bundle = BundleTransaction {
                bundle_id,
                seller: seller.clone(),
                buyer: None,
                items,
                total_price,
                currency,
                state: crate::types::TransactionState::Pending,
                created_at: env.ledger().timestamp(),
                expires_at: env.ledger().timestamp() + duration_seconds,
                platform_fee: 0, // Would be calculated
            };

            BundleTransactionStore::put(&env, &bundle)?;
            Ok(bundle_id)
        })
    }

    /// Cancel a transaction
    pub fn cancel_transaction(
        env: Env,
        transaction_id: u64,
        transaction_type: Symbol, // "sale", "auction", "trade", "bundle"
        canceller: Address,
    ) -> Result<(), SettlementError> {
        canceller.require_auth();

        // Check if contract is paused (global check for cancel)
        PauseManager::check_not_paused(&env)?;

        ReentrancyGuard::execute(&env, &canceller, "cancel_transaction", || {
            if transaction_type == Symbol::new(&env, "sale") {
                let mut sale = SaleTransactionStore::get(&env, transaction_id)?;
                if sale.seller != canceller {
                    return Err(SettlementError::Unauthorized);
                }
                if sale.state != crate::types::TransactionState::Pending {
                    return Err(SettlementError::InvalidState);
                }
                AtomicSwapEngine::cancel_swap(&env, transaction_id, &canceller)?;
                sale.state = crate::types::TransactionState::Cancelled;
                SaleTransactionStore::update(&env, &sale)?;
            } else {
                return Err(SettlementError::InvalidAmount);
            }
            Ok(())
        })
    }

    /// Initiate a dispute
    pub fn initiate_dispute(
        env: Env,
        transaction_id: u64,
        reason: Bytes,
        evidence_uri: Option<Bytes>,
        initiator: Address,
    ) -> Result<u64, SettlementError> {
        initiator.require_auth();

        // Check if disputes module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Disputes)?;

        ReentrancyGuard::execute(&env, &initiator, "initiate_dispute", || {
            DisputeResolutionManager::initiate_dispute(
                &env,
                transaction_id,
                None, // No auction ID for now
                &initiator,
                &reason,
                evidence_uri,
            )
        })
    }

    /// Vote on a dispute
    pub fn vote_on_dispute(
        env: Env,
        dispute_id: u64,
        arbitrator: Address,
        vote: u64,
    ) -> Result<(), SettlementError> {
        arbitrator.require_auth();

        // Check if disputes module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Disputes)?;

        ReentrancyGuard::execute(&env, &arbitrator, "vote_on_dispute", || {
            DisputeResolutionManager::vote_on_dispute(&env, dispute_id, &arbitrator, vote)
        })
    }

    /// Execute dispute resolution
    pub fn execute_dispute_resolution(
        env: Env,
        dispute_id: u64,
        executor: Address,
    ) -> Result<(), SettlementError> {
        executor.require_auth();

        // Check if disputes module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Disputes)?;

        ReentrancyGuard::execute(&env, &executor, "execute_dispute_resolution", || {
            DisputeResolutionManager::execute_dispute_resolution(&env, dispute_id, &executor)
        })
    }

    /// Force-resolve a dispute with a binding outcome (dispute admin only)
    ///
    /// `admin` must authenticate and must be either the primary admin from
    /// `AdminConfig` or an address in the dispute admin registry; it is not
    /// trusted merely because a caller names it. The outcome is validated, recorded,
    /// and paid out from the real escrow holdings in the same call.
    pub fn force_resolve_dispute(
        env: Env,
        dispute_id: u64,
        resolution: u64,
        admin: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        // Check if disputes module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Disputes)?;

        ReentrancyGuard::execute(&env, &admin, "force_resolve_dispute", || {
            DisputeResolutionManager::force_resolve_dispute(&env, dispute_id, resolution, &admin)
        })
    }

    /// Settle a dispute whose arbitration stalled past `DisputeConfig::dispute_timeout`
    ///
    /// Permissionless: the most a caller can do is apply the outcome the
    /// configuration already prescribes once the deadline has elapsed.
    pub fn resolve_dispute_timeout(
        env: Env,
        dispute_id: u64,
        caller: Address,
    ) -> Result<(), SettlementError> {
        caller.require_auth();

        // Check if disputes module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Disputes)?;

        ReentrancyGuard::execute(&env, &caller, "resolve_dispute_timeout", || {
            DisputeResolutionManager::resolve_dispute_timeout(&env, dispute_id, &caller)
        })
    }

    /// Submit a binding resolution from a registered arbitration oracle
    ///
    /// The oracle must authenticate (so a multi-sig or DAO oracle enforces its own
    /// approval policy), must be registered and active, and must present an ed25519
    /// signature from its registered public key over
    /// `dispute_oracle_payload(dispute_id, transaction_id, resolution)`. The
    /// resolution is then paid out of escrow immediately.
    pub fn submit_oracle_resolution(
        env: Env,
        dispute_id: u64,
        resolution: u64,
        oracle: Address,
        signature: BytesN<64>,
    ) -> Result<(), SettlementError> {
        // Check if disputes module is paused
        PauseManager::check_module_not_paused(&env, ModuleType::Disputes)?;

        ReentrancyGuard::execute(&env, &oracle, "submit_oracle_resolution", || {
            DisputeResolutionManager::submit_oracle_resolution(
                &env, dispute_id, resolution, &oracle, &signature,
            )
        })
    }

    /// Bytes an arbitration oracle must sign for `dispute_id`
    ///
    /// View helper so an off-chain resolver can reproduce the exact payload the
    /// contract verifies, without trusting caller-supplied fields.
    pub fn dispute_oracle_payload(
        env: Env,
        dispute_id: u64,
        resolution: u64,
    ) -> Result<Bytes, SettlementError> {
        let dispute = DisputeResolutionManager::get_dispute(&env, dispute_id)?;
        Ok(DisputeResolutionManager::oracle_attestation_payload(
            &env,
            dispute_id,
            dispute.transaction_id,
            resolution,
        ))
    }

    /// Register or update an arbitration oracle (dispute admin only)
    pub fn register_arbitration_oracle(
        env: Env,
        admin: Address,
        oracle: Address,
        public_key: BytesN<32>,
        is_active: bool,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        ReentrancyGuard::execute(&env, &admin, "register_arbitration_oracle", || {
            DisputeResolutionManager::register_oracle(&env, &admin, &oracle, &public_key, is_active)
        })
    }

    /// Get a registered arbitration oracle (view function)
    pub fn get_arbitration_oracle(env: Env, oracle: Address) -> Option<ArbitrationOracle> {
        DisputeResolutionManager::get_oracle(&env, &oracle)
    }

    /// Register an address as an eligible arbitrator
    pub fn register_arbitrator(
        env: Env,
        arbitrator: Address,
        initial_reputation: u64,
    ) -> Result<(), SettlementError> {
        arbitrator.require_auth();

        DisputeResolutionManager::register_arbitrator(&env, &arbitrator, initial_reputation)
    }

    /// Adjust an arbitrator's reputation (dispute admin only)
    pub fn update_arbitrator_reputation(
        env: Env,
        admin: Address,
        arbitrator: Address,
        reputation_change: i32,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        if !DisputeResolutionManager::is_dispute_admin(&env, &admin) {
            return Err(SettlementError::NotAdmin);
        }

        ReentrancyGuard::execute(&env, &admin, "update_arbitrator_reputation", || {
            DisputeResolutionManager::update_arbitrator_reputation(
                &env,
                &arbitrator,
                reputation_change,
            )
        })
    }

    /// Rotate the arbitrator selection entropy (dispute admin only)
    pub fn reseed_arbitrator_selection(env: Env, admin: Address) -> Result<(), SettlementError> {
        admin.require_auth();

        ReentrancyGuard::execute(&env, &admin, "reseed_arbitrator_selection", || {
            DisputeResolutionManager::reseed_arbitrator_selection(&env, &admin)
        })
    }

    /// Add an address to the dispute admin registry (dispute admin only)
    pub fn add_dispute_admin(
        env: Env,
        admin: Address,
        new_admin: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        ReentrancyGuard::execute(&env, &admin, "add_dispute_admin", || {
            DisputeResolutionManager::add_dispute_admin(&env, &admin, &new_admin)
        })
    }

    /// Remove an address from the dispute admin registry (dispute admin only)
    pub fn remove_dispute_admin(
        env: Env,
        admin: Address,
        target: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        ReentrancyGuard::execute(&env, &admin, "remove_dispute_admin", || {
            DisputeResolutionManager::remove_dispute_admin(&env, &admin, &target)
        })
    }

    /// Addresses in the dispute admin registry (view function)
    pub fn get_dispute_admins(env: Env) -> Vec<Address> {
        DisputeResolutionManager::get_dispute_admins(&env)
    }

    /// Whether `address` can perform dispute administration (view function)
    pub fn is_dispute_admin(env: Env, address: Address) -> bool {
        DisputeResolutionManager::is_dispute_admin(&env, &address)
    }

    /// Get a dispute (view function)
    pub fn get_dispute(env: Env, dispute_id: u64) -> Result<Dispute, SettlementError> {
        DisputeResolutionManager::get_dispute(&env, dispute_id)
    }

    /// Get the dispute/arbitration configuration (view function)
    pub fn get_dispute_config(env: Env) -> Result<DisputeConfig, SettlementError> {
        DisputeResolutionManager::get_dispute_config(&env)
    }

    /// Replace the dispute/arbitration configuration (dispute admin only)
    pub fn update_dispute_config(
        env: Env,
        config: DisputeConfig,
        admin: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        ReentrancyGuard::execute(&env, &admin, "update_dispute_config", || {
            DisputeResolutionManager::update_dispute_config(&env, &config, &admin)
        })
    }

    /// Emergency withdrawal (admin only) - NOT paused
    pub fn emergency_withdraw(
        env: Env,
        transaction_id: u64,
        reason: Bytes,
        admin: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        ReentrancyGuard::execute(&env, &admin, "emergency_withdraw", || {
            // Check admin permissions
            let admin_config: AdminConfig = env
                .storage()
                .instance()
                .get(&symbol_short!("admin_cfg"))
                .ok_or(SettlementError::Unauthorized)?;

            if admin_config.admin != admin {
                return Err(SettlementError::Unauthorized);
            }

            if !admin_config.emergency_withdrawal_enabled {
                return Err(SettlementError::InvalidState);
            }

            AtomicSwapEngine::emergency_withdraw(&env, transaction_id, &admin, &reason)
        })
    }

    /// Update fee configuration (admin only)
    pub fn update_fee_config(
        env: Env,
        new_config: FeeConfig,
        admin: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        ReentrancyGuard::execute(&env, &admin, "update_fee_config", || {
            // Check admin permissions
            let admin_config: AdminConfig = env
                .storage()
                .instance()
                .get(&symbol_short!("admin_cfg"))
                .ok_or(SettlementError::Unauthorized)?;

            if admin_config.admin != admin {
                return Err(SettlementError::Unauthorized);
            }

            FeeManager::update_fee_config(&env, &new_config, &admin)
        })
    }

    /// Withdraw platform fees (admin only)
    pub fn withdraw_platform_fees(
        env: Env,
        asset: Asset,
        recipient: Address,
        admin: Address,
    ) -> Result<i128, SettlementError> {
        admin.require_auth();
        ReentrancyGuard::execute(&env, &admin, "withdraw_platform_fees", || {
            // Check admin permissions
            let admin_config: AdminConfig = env
                .storage()
                .instance()
                .get(&symbol_short!("admin_cfg"))
                .ok_or(SettlementError::Unauthorized)?;

            if admin_config.admin != admin {
                return Err(SettlementError::Unauthorized);
            }

            FeeManager::withdraw_platform_fees(&env, &asset, &recipient, &admin)
        })
    }

    /// Update rate limit configuration for a specific function (admin only)
    pub fn update_rate_limit(
        env: Env,
        function: Symbol,
        limit: u32,
        window_seconds: u64,
        admin: Address,
    ) -> Result<(), SettlementError> {
        // Check admin permissions
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        crate::security::rate_limiter::RateLimiter::set_config(
            &env,
            &function,
            limit,
            window_seconds,
        );
        Ok(())
    }

    /// Get rate limit configuration for a specific function
    pub fn get_rate_limit_config(
        env: Env,
        function: Symbol,
    ) -> Option<crate::security::rate_limiter::RateLimitConfig> {
        crate::security::rate_limiter::RateLimiter::get_config(&env, &function)
    }

    /// Get transaction details
    pub fn get_sale(env: Env, transaction_id: u64) -> Result<SaleTransaction, SettlementError> {
        SaleTransactionStore::get(&env, transaction_id)
    }

    /// Get auction details
    pub fn get_auction(env: Env, auction_id: u64) -> Result<AuctionTransaction, SettlementError> {
        AuctionStore::get(&env, auction_id)
    }

    /// Get current Dutch auction price
    pub fn get_dutch_auction_price(env: Env, auction_id: u64) -> Result<i128, SettlementError> {
        AuctionEngine::get_dutch_auction_price(&env, auction_id)
    }

    /// Get accumulated fees
    pub fn get_accumulated_fees(env: Env, asset: Asset) -> i128 {
        FeeManager::get_accumulated_fees(&env, &asset)
    }

    /// Get user volume
    pub fn get_user_volume(env: Env, user: Address) -> Result<i128, SettlementError> {
        FeeManager::get_user_volume(&env, &user)
    }

    /// Cleanup expired commitments
    pub fn cleanup_expired_commitments(env: Env) -> Result<(), SettlementError> {
        AuctionEngine::cleanup_expired_commitments(&env)
    }

    /// Sweep expired atomic swaps, marking them failed and refunding escrow
    ///
    /// Callable by anyone: the only thing it can do is return escrowed assets to the
    /// parties that deposited them. `limit` bounds how many swaps a single call
    /// expires (0 applies the built-in default); repeat until it returns 0.
    pub fn cleanup_expired_swaps(
        env: Env,
        caller: Address,
        limit: u32,
    ) -> Result<u32, SettlementError> {
        caller.require_auth();

        // Routine timeout processing halts with the circuit breaker, same as cancel.
        PauseManager::check_not_paused(&env)?;

        ReentrancyGuard::execute(&env, &caller.clone(), "cleanup_expired_swaps", || {
            AtomicSwapEngine::cleanup_expired_swaps(&env, &caller, limit)
        })
    }

    /// Expire one atomic swap by transaction id, refunding its escrow
    ///
    /// Callable by anyone. Fails until both the timestamp deadline and the
    /// ledger-sequence tolerance have passed.
    pub fn expire_swap(
        env: Env,
        transaction_id: u64,
        caller: Address,
    ) -> Result<u32, SettlementError> {
        caller.require_auth();
        PauseManager::check_not_paused(&env)?;

        ReentrancyGuard::execute(&env, &caller.clone(), "expire_swap", || {
            AtomicSwapEngine::expire_swap(&env, transaction_id, &caller)
        })
    }

    /// Reclaim escrow holdings that are past their own backstop deadline
    ///
    /// Callable by anyone; funds only ever return to the original depositor. This is
    /// the guarantee that escrowed value cannot stay locked indefinitely even if a
    /// swap is never completed, cancelled, or expired.
    ///
    /// Deliberately not gated on the pause state. It is a last-resort recovery path,
    /// like `emergency_withdraw`, and gating it would mean a paused contract could
    /// hold deposits past every deadline — which is the exact failure this backstop
    /// exists to rule out.
    pub fn reclaim_expired_escrow(
        env: Env,
        transaction_id: u64,
        caller: Address,
    ) -> Result<u32, SettlementError> {
        caller.require_auth();
        ReentrancyGuard::execute(&env, &caller.clone(), "reclaim_expired_escrow", || {
            AtomicSwapEngine::reclaim_expired_escrow(&env, transaction_id, &caller)
        })
    }

    /// Update the atomic swap timeout policy (admin only)
    pub fn update_swap_timeout_config(
        env: Env,
        new_config: SwapTimeoutConfig,
        admin: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        ReentrancyGuard::execute(&env, &admin, "update_swap_timeout_config", || {
            let admin_config: AdminConfig = env
                .storage()
                .instance()
                .get(&symbol_short!("admin_cfg"))
                .ok_or(SettlementError::Unauthorized)?;

            if admin_config.admin != admin {
                return Err(SettlementError::Unauthorized);
            }

            AtomicSwapEngine::set_timeout_config(&env, &new_config, &admin)
        })
    }

    /// Get the atomic swap timeout policy currently in force
    pub fn get_swap_timeout_config(env: Env) -> SwapTimeoutConfig {
        AtomicSwapEngine::timeout_config(&env)
    }

    /// Get the atomic swap backing a transaction
    pub fn get_atomic_swap(
        env: Env,
        transaction_id: u64,
    ) -> Result<crate::atomic_swap::AtomicSwap, SettlementError> {
        AtomicSwapEngine::get_swap_by_transaction(&env, transaction_id)
    }

    /// Seconds left before a swap's deadline (including grace); 0 once past it
    pub fn get_swap_time_remaining(env: Env, transaction_id: u64) -> Result<u64, SettlementError> {
        AtomicSwapEngine::time_remaining(&env, transaction_id)
    }

    /// Add allowed NFT contract (admin only)
    pub fn add_allowed_nft_contract(
        env: Env,
        admin: Address,
        contract: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        AllowlistStore::set_nft_allowed(&env, &contract, true);
        Ok(())
    }

    /// Remove allowed NFT contract (admin only)
    pub fn remove_allowed_nft_contract(
        env: Env,
        admin: Address,
        contract: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        AllowlistStore::set_nft_allowed(&env, &contract, false);
        Ok(())
    }

    /// Add allowed token contract (admin only)
    pub fn add_allowed_token_contract(
        env: Env,
        admin: Address,
        contract: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        AllowlistStore::set_token_allowed(&env, &contract, true);
        Ok(())
    }

    /// Remove allowed token contract (admin only)
    pub fn remove_allowed_token_contract(
        env: Env,
        admin: Address,
        contract: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;
        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }
        AllowlistStore::set_token_allowed(&env, &contract, false);
        Ok(())
    }

    /// Read whether `contract` is allowlisted for NFT settlement (view function).
    ///
    /// Used by deployment tooling and off-chain verifiers to confirm that a
    /// freshly deployed NFT contract has been wired into the marketplace.
    pub fn is_nft_allowed(env: Env, contract: Address) -> bool {
        AllowlistStore::is_nft_allowed(&env, &contract)
    }

    /// Read whether `contract` is allowlisted for token settlement (view
    /// function). See [`Self::is_nft_allowed`].
    pub fn is_token_allowed(env: Env, contract: Address) -> bool {
        AllowlistStore::is_token_allowed(&env, &contract)
    }

    /// Block an address (admin only)
    pub fn block_address(
        env: Env,
        admin: Address,
        address: Address,
        reason: u32,
        expires_at: Option<u64>,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        // Check admin permissions
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        let block_reason = match reason {
            0 => crate::storage::blocklist_store::BlockReason::Scam,
            1 => crate::storage::blocklist_store::BlockReason::Sanctioned,
            2 => crate::storage::blocklist_store::BlockReason::Suspicious,
            3 => crate::storage::blocklist_store::BlockReason::Temporary,
            4 => crate::storage::blocklist_store::BlockReason::AdminOverride,
            _ => return Err(SettlementError::InvalidAmount),
        };

        crate::storage::blocklist_store::BlocklistStore::block_address(
            &env,
            &admin,
            &address,
            block_reason.clone(),
            expires_at,
        )?;

        emit_address_blocked(
            &env,
            AddressBlockedEvent {
                blocked_address: address.clone(),
                blocked_by: admin,
                reason,
                expires_at,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Unblock an address (admin only)
    pub fn unblock_address(
        env: Env,
        admin: Address,
        address: Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        // Check admin permissions
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        crate::storage::blocklist_store::BlocklistStore::unblock_address(&env, &address);

        emit_address_unblocked(
            &env,
            AddressUnblockedEvent {
                unblocked_address: address.clone(),
                unblocked_by: admin,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Update block reason for an address (admin only)
    pub fn update_block_reason(
        env: Env,
        admin: Address,
        address: Address,
        reason: u32,
        expires_at: Option<u64>,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        // Check admin permissions
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        let block_reason = match reason {
            0 => crate::storage::blocklist_store::BlockReason::Scam,
            1 => crate::storage::blocklist_store::BlockReason::Sanctioned,
            2 => crate::storage::blocklist_store::BlockReason::Suspicious,
            3 => crate::storage::blocklist_store::BlockReason::Temporary,
            4 => crate::storage::blocklist_store::BlockReason::AdminOverride,
            _ => return Err(SettlementError::InvalidAmount),
        };

        crate::storage::blocklist_store::BlocklistStore::update_block_reason(
            &env,
            &admin,
            &address,
            block_reason,
            expires_at,
        )?;

        Ok(())
    }

    /// Check if an address is blocked (view function)
    pub fn is_blocked(env: Env, address: Address) -> bool {
        crate::storage::blocklist_store::BlocklistStore::is_blocked(&env, &address)
    }

    /// Get blocked addresses (view function)
    pub fn get_blocked_addresses(
        env: Env,
    ) -> Vec<(Address, crate::storage::blocklist_store::BlockRecord)> {
        let map = crate::storage::blocklist_store::BlocklistStore::get_blocked_addresses(&env);
        let mut result = Vec::new(&env);
        for (addr, record) in map.iter() {
            result.push_back((addr, record));
        }
        result
    }

    /// Get block record for an address (view function)
    pub fn get_block_record(
        env: Env,
        address: Address,
    ) -> Option<crate::storage::blocklist_store::BlockRecord> {
        crate::storage::blocklist_store::BlocklistStore::get_block_record(&env, &address)
    }

    // -------------------------------------------------------------------------
    // Native XLM Configuration
    // -------------------------------------------------------------------------

    /// Update the native XLM Stellar Asset Contract (SAC) address (admin only).
    ///
    /// Use this to configure or update the XLM SAC address after initialization.
    /// On mainnet, pass the canonical XLM SAC address.
    pub fn set_native_xlm_sac(
        env: Env,
        admin: Address,
        native_xlm_sac: Option<Address>,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let admin_config: AdminConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("admin_cfg"))
            .ok_or(SettlementError::Unauthorized)?;

        if admin_config.admin != admin {
            return Err(SettlementError::Unauthorized);
        }

        if let Some(address) = native_xlm_sac {
            env.storage()
                .instance()
                .set(&symbol_short!("xlm_sac"), &address);
        } else {
            env.storage().instance().remove(&symbol_short!("xlm_sac"));
        }

        Ok(())
    }

    /// Get the configured native XLM SAC address (view function).
    pub fn get_native_xlm_sac(env: Env) -> Option<Address> {
        env.storage().instance().get(&symbol_short!("xlm_sac"))
    }

    // -------------------------------------------------------------------------
    // Versioning
    // -------------------------------------------------------------------------

    /// Returns the semver string with embedded git commit: "0.1.0+abc1234"
    pub fn version(env: Env) -> String {
        version::version(&env)
    }

    /// Returns full build metadata for incident response:
    /// "version=0.1.0;git=abc1234;ts=1700000000;rustc=rustc 1.x.y"
    pub fn get_version(env: Env) -> String {
        version::get_version(&env)
    }
}
