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
    FeeConfig, SaleTransaction, TradeTransaction,
};
use crate::utils::{asset_utils, time_utils};
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Bytes, Env, Symbol, Vec};

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
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_config: FeeConfig,
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
            asset_utils::check_nft_ownership(&nft_address, token_id, &seller, &env)?;

            // Calculate royalties (with seller and platform addresses)
            let fee_config = FeeManager::get_fee_config(&env)?;
            let royalty_distribution = RoyaltyDistributor::calculate_royalties(
                &env,
                &nft_address,
                token_id,
                price,
                &seller,
                &fee_config.fee_recipient,
            )?;

            // Calculate platform fee
            let platform_fee = FeeManager::calculate_fee(&env, price, &seller)?;

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

            // Initialize atomic swap
            AtomicSwapEngine::initialize_swap(
                &env,
                transaction_id,
                &seller,
                &seller, // Placeholder buyer
                &nft_address,
                token_id,
                &currency,
                price,
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
            AtomicSwapEngine::execute_swap(&env, transaction_id, &buyer)?;

            // Distribute royalties and fees
            let distribution_result = RoyaltyDistributor::distribute_royalties(
                &env,
                transaction_id,
                &sale.royalty_info,
                &sale.currency,
            )?;

            // Collect platform fee
            FeeManager::collect_platform_fee(&env, sale.platform_fee, &sale.currency, &buyer)?;

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
}