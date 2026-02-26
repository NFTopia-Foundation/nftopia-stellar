use crate::error::SettlementError;
use crate::events::{
    emit_auction_created, emit_auction_ended, emit_auction_extended, emit_bid_placed,
    emit_bid_revealed, AuctionCreatedEvent, AuctionEndedEvent, AuctionExtendedEvent,
    BidPlacedEvent, BidRevealedEvent,
};
use crate::security::frontrun_protection::{CommitRevealScheme, FrontRunningDetector};
use crate::storage::auction_store::{AuctionStore, DutchAuctionStore};
use crate::types::{
    Asset, AuctionTransaction, AuctionType, Bid, DutchAuctionData, RoyaltyDistribution,
    TransactionState,
};
use crate::utils::{math_utils, time_utils};
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Map, Symbol, Vec};

// Storage keys
const AUCTION_CONFIG: Symbol = symbol_short!("auc_cfg");

/// Auction configuration
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AuctionConfig {
    pub min_bid_increment_bps: u64, // Minimum bid increment in basis points
    pub max_auction_duration: u64,  // Maximum auction duration in seconds
    pub extension_window: u64,      // Time extension window for last-minute bids
    pub dutch_price_decrement: u64, // Price decrement per time unit for Dutch auctions
    pub commit_reveal_enabled: u64, // Whether commit-reveal is enabled (0 = false, 1 = true)
    pub reveal_period: u64,         // Time allowed for bid reveals
}

/// Auction engine for managing different auction types
pub struct AuctionEngine;

impl AuctionEngine {
    /// Create a new auction
    pub fn create_auction(
        env: &Env,
        auction_type: AuctionType,
        seller: &Address,
        nft_contract: &Address,
        token_id: u64,
        starting_price: i128,
        reserve_price: i128,
        duration_seconds: u64,
        bid_increment: i128,
        currency: &Asset,
    ) -> Result<u64, SettlementError> {
        let config = Self::get_auction_config(env)?;

        // Validate auction parameters
        Self::validate_auction_params(
            starting_price,
            reserve_price,
            duration_seconds,
            bid_increment,
            &config,
        )?;

        let auction_id = AuctionStore::next_id(env);
        let start_time = env.ledger().timestamp();
        let end_time = start_time + duration_seconds;

        // Validate timing
        time_utils::validate_auction_timing(start_time, end_time, config.extension_window, env)?;

        let auction = AuctionTransaction {
            auction_id,
            seller: seller.clone(),
            nft_address: nft_contract.clone(),
            token_id,
            starting_price,
            reserve_price,
            highest_bid: 0,
            highest_bidder: None,
            bid_increment,
            start_time,
            end_time,
            state: TransactionState::Pending,
            bids: Vec::new(env),
            extension_window: config.extension_window,
            currency: currency.clone(),
            royalty_info: RoyaltyDistribution {
                creator_address: seller.clone(), // Placeholder
                creator_percentage: 500,         // 5%
                seller_percentage: 9500,         // 95%
                platform_percentage: 0,
                total_amount: 0,
                amounts: Map::new(env),
            }, // Would be set from NFT contract
            platform_fee: 0, // Would be calculated
        };

        AuctionStore::put(env, &auction)?;

        // If Dutch auction, create Dutch auction data
        if auction_type == AuctionType::Dutch {
            let dutch_data = DutchAuctionData {
                starting_price,
                ending_price: reserve_price, // Reserve acts as floor price
                price_decrement: config.dutch_price_decrement,
                time_unit: 3600, // 1 hour
                current_price: starting_price,
                last_price_update: start_time,
            };
            DutchAuctionStore::put(env, auction_id, &dutch_data)?;
        }

        // Emit auction created event
        let event = AuctionCreatedEvent {
            auction_id,
            seller: seller.clone(),
            nft_address: nft_contract.clone(),
            token_id,
            starting_price,
            reserve_price,
            currency: currency.clone(),
            end_time,
            auction_type,
            timestamp: start_time,
        };
        emit_auction_created(env, event);

        Ok(auction_id)
    }

    /// Place a bid on an auction
    pub fn place_bid(
        env: &Env,
        auction_id: u64,
        bidder: &Address,
        bid_amount: i128,
        commitment_hash: Option<Bytes>,
    ) -> Result<(), SettlementError> {
        let mut auction = AuctionStore::get(env, auction_id)?;

        // Validate auction is active
        if !Self::is_auction_active(&auction, env)? {
            return Err(SettlementError::AuctionAlreadyEnded);
        }

        // Validate bid amount
        Self::validate_bid_amount(&auction, bid_amount, env)?;

        let config = Self::get_auction_config(env)?;
        let timestamp = env.ledger().timestamp();

        let (is_committed, commitment_hash) = if config.commit_reveal_enabled == 1 {
            if let Some(commitment) = commitment_hash {
                // Store commitment for later reveal
                CommitRevealScheme::store_commitment(
                    env,
                    bidder,
                    auction_id,
                    &commitment,
                    timestamp + config.reveal_period,
                )?;

                (true, Some(commitment))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        };

        // Check for front-running patterns
        let recent_bids = AuctionStore::get_bids(env, auction_id);
        FrontRunningDetector::analyze_bidding_pattern(
            env,
            auction_id,
            &Bid {
                bidder: bidder.clone(),
                amount: bid_amount,
                placed_at: timestamp,
                is_committed,
                commitment_hash: commitment_hash.clone(),
            },
            &recent_bids,
        )?;

        let bid = Bid {
            bidder: bidder.clone(),
            amount: bid_amount,
            placed_at: timestamp,
            is_committed,
            commitment_hash,
        };

        // Store bid
        AuctionStore::add_bid(env, auction_id, &bid)?;

        // Update auction if direct bid
        if !bid.is_committed {
            AuctionStore::update(env, &auction)?;
        }

        // Check if auction should be extended
        if time_utils::should_extend_auction(
            auction.end_time,
            timestamp,
            auction.extension_window,
            env,
        ) {
            let new_end_time = time_utils::calculate_extended_end_time(
                auction.end_time,
                auction.extension_window,
                env,
            );

            auction.end_time = new_end_time;
            AuctionStore::update(env, &auction)?;

            // Emit extension event
            let event = AuctionExtendedEvent {
                auction_id,
                new_end_time,
                extension_reason: Bytes::from_slice(env, "last_minute_bid".as_bytes()),
                timestamp,
            };
            emit_auction_extended(env, event);
        }

        // Emit bid placed event
        let event = BidPlacedEvent {
            auction_id,
            bidder: bidder.clone(),
            amount: bid_amount,
            is_committed: bid.is_committed,
            timestamp,
        };
        emit_bid_placed(env, event);

        Ok(())
    }

    /// Reveal a committed bid
    pub fn reveal_bid(
        env: &Env,
        auction_id: u64,
        bidder: &Address,
        bid_amount: i128,
        salt: &Bytes,
    ) -> Result<(), SettlementError> {
        let config = Self::get_auction_config(env)?;
        if config.commit_reveal_enabled == 0 {
            return Err(SettlementError::InvalidState);
        }

        // Verify commitment
        CommitRevealScheme::reveal_commitment(env, bidder, auction_id, bid_amount, salt)?;

        let mut auction = AuctionStore::get(env, auction_id)?;

        // Process the revealed bid
        let timestamp = env.ledger().timestamp();
        Self::process_direct_bid(env, &mut auction, bidder, bid_amount, timestamp)?;

        // Update the committed bid to revealed
        AuctionStore::update_bid(
            env,
            auction_id,
            bidder,
            &Bid {
                bidder: bidder.clone(),
                amount: bid_amount,
                placed_at: timestamp,
                is_committed: false,
                commitment_hash: None,
            },
        )?;

        AuctionStore::update(env, &auction)?;

        // Emit bid revealed event
        let event = BidRevealedEvent {
            auction_id,
            bidder: bidder.clone(),
            amount: bid_amount,
            timestamp,
        };
        emit_bid_revealed(env, event);

        Ok(())
    }

    /// End an auction
    pub fn end_auction(
        env: &Env,
        auction_id: u64,
        _caller: &Address,
    ) -> Result<(), SettlementError> {
        let mut auction = AuctionStore::get(env, auction_id)?;

        // Check if auction can be ended
        if !Self::can_end_auction(&auction, env)? {
            return Err(SettlementError::InvalidState);
        }

        let timestamp = env.ledger().timestamp();
        let mut reason = "ended";

        // Determine winner and final price
        let (winner, final_price) = if auction.highest_bid >= auction.reserve_price {
            (auction.highest_bidder.clone(), auction.highest_bid)
        } else {
            reason = "reserve_not_met";
            (None, 0)
        };

        // Update auction state
        auction.state = TransactionState::Executed;
        AuctionStore::update(env, &auction)?;

        // Emit auction ended event
        let event = AuctionEndedEvent {
            auction_id,
            winner,
            final_price,
            reason: Bytes::from_slice(env, reason.as_bytes()),
            timestamp,
        };
        emit_auction_ended(env, event);

        Ok(())
    }

    /// Get current price for Dutch auction
    pub fn get_dutch_auction_price(env: &Env, auction_id: u64) -> Result<i128, SettlementError> {
        let auction = AuctionStore::get(env, auction_id)?;
        let dutch_data = DutchAuctionStore::get(env, auction_id)?;

        let current_time = env.ledger().timestamp();

        // Update price if needed
        let updated_price = math_utils::calculate_time_weighted_price(
            dutch_data.last_price_update,
            auction.end_time,
            current_time,
            dutch_data.current_price,
            dutch_data.ending_price,
            env,
        )?;

        // Update stored price
        let mut updated_data = dutch_data;
        updated_data.current_price = updated_price;
        updated_data.last_price_update = current_time;
        DutchAuctionStore::update(env, auction_id, &updated_data)?;

        Ok(updated_price)
    }

    /// Cancel an auction
    pub fn cancel_auction(
        env: &Env,
        auction_id: u64,
        canceller: &Address,
    ) -> Result<(), SettlementError> {
        let mut auction = AuctionStore::get(env, auction_id)?;

        // Only seller can cancel
        if &auction.seller != canceller {
            return Err(SettlementError::Unauthorized);
        }

        // Can only cancel if no bids placed
        if auction.highest_bid > 0 {
            return Err(SettlementError::InvalidState);
        }

        auction.state = TransactionState::Cancelled;
        AuctionStore::update(env, &auction)?;

        Ok(())
    }

    /// Get auction configuration
    pub fn get_auction_config(env: &Env) -> Result<AuctionConfig, SettlementError> {
        env.storage()
            .instance()
            .get(&AUCTION_CONFIG)
            .ok_or(SettlementError::NotFound)
    }

    /// Update auction configuration
    pub fn update_auction_config(
        env: &Env,
        config: &AuctionConfig,
        _admin: &Address,
    ) -> Result<(), SettlementError> {
        // Check admin permissions
        env.storage().instance().set(&AUCTION_CONFIG, config);
        Ok(())
    }

    /// Internal: Validate auction parameters
    fn validate_auction_params(
        starting_price: i128,
        reserve_price: i128,
        duration: u64,
        bid_increment: i128,
        config: &AuctionConfig,
    ) -> Result<(), SettlementError> {
        if starting_price <= 0 {
            return Err(SettlementError::InvalidAmount);
        }

        if reserve_price < 0 || reserve_price > starting_price {
            return Err(SettlementError::InvalidAmount);
        }

        if duration == 0 || duration > config.max_auction_duration {
            return Err(SettlementError::InvalidAmount);
        }

        if bid_increment <= 0 {
            return Err(SettlementError::InvalidBidIncrement);
        }

        Ok(())
    }

    /// Internal: Check if auction is active
    fn is_auction_active(auction: &AuctionTransaction, env: &Env) -> Result<bool, SettlementError> {
        let current_time = env.ledger().timestamp();
        Ok(current_time >= auction.start_time
            && current_time <= auction.end_time
            && auction.state == TransactionState::Pending)
    }

    /// Internal: Validate bid amount
    fn validate_bid_amount(
        auction: &AuctionTransaction,
        bid_amount: i128,
        env: &Env,
    ) -> Result<(), SettlementError> {
        // Must be higher than current highest bid
        if bid_amount <= auction.highest_bid {
            return Err(SettlementError::BidTooLow);
        }

        // Must meet minimum increment
        if auction.highest_bid > 0 {
            let min_increment = math_utils::calculate_bid_increment(
                auction.highest_bid,
                (auction.bid_increment.max(100) as u64).max(100), // At least 1%
                env,
            )?;
            if bid_amount < auction.highest_bid + min_increment {
                return Err(SettlementError::BidTooLow);
            }
        } else {
            // First bid must meet or exceed starting price
            if bid_amount < auction.starting_price {
                return Err(SettlementError::BidTooLow);
            }
        }

        Ok(())
    }

    /// Internal: Process a direct bid
    fn process_direct_bid(
        _env: &Env,
        auction: &mut AuctionTransaction,
        bidder: &Address,
        bid_amount: i128,
        timestamp: u64,
    ) -> Result<Bid, SettlementError> {
        // Update auction state
        auction.highest_bid = bid_amount;
        auction.highest_bidder = Some(bidder.clone());

        Ok(Bid {
            bidder: bidder.clone(),
            amount: bid_amount,
            placed_at: timestamp,
            is_committed: false,
            commitment_hash: None,
        })
    }

    /// Internal: Check if auction can be ended
    fn can_end_auction(auction: &AuctionTransaction, env: &Env) -> Result<bool, SettlementError> {
        let current_time = env.ledger().timestamp();

        // Auction must be started and time expired, or seller wants to end it
        Ok(current_time > auction.end_time && auction.state == TransactionState::Pending)
    }

    /// Internal: Clean up expired commitments
    pub fn cleanup_expired_commitments(env: &Env) -> Result<(), SettlementError> {
        CommitRevealScheme::cleanup_expired_commitments(env)
    }
}

/// Default auction configuration
impl Default for AuctionConfig {
    fn default() -> Self {
        Self {
            min_bid_increment_bps: 100,   // 1%
            max_auction_duration: 604800, // 7 days
            extension_window: 300,        // 5 minutes
            dutch_price_decrement: 1000,  // 1000 units per time unit
            commit_reveal_enabled: 0,
            reveal_period: 3600, // 1 hour
        }
    }
}

/// Auction statistics and analytics
pub struct AuctionAnalytics;

impl AuctionAnalytics {
    /// Get auction statistics
    pub fn get_auction_stats(env: &Env, auction_id: u64) -> Result<AuctionStats, SettlementError> {
        let auction = AuctionStore::get(env, auction_id)?;
        let bids = AuctionStore::get_bids(env, auction_id);

        Ok(AuctionStats {
            total_bids: bids.len() as u64,
            unique_bidders: Self::count_unique_bidders(&bids) as u64,
            highest_bid: auction.highest_bid,
            average_bid: Self::calculate_average_bid(&bids),
            bid_frequency: Self::calculate_bid_frequency(&bids),
        })
    }

    /// Count unique bidders
    fn count_unique_bidders(bids: &Vec<Bid>) -> u32 {
        let mut unique = Vec::new(&Env::default());

        for bid in bids.iter() {
            if !unique.contains(bid.bidder.clone()) {
                unique.push_back(bid.bidder.clone());
            }
        }

        unique.len()
    }

    /// Calculate average bid amount
    fn calculate_average_bid(bids: &Vec<Bid>) -> i128 {
        if bids.is_empty() {
            return 0;
        }

        let mut total: i128 = 0;
        for bid in bids.iter() {
            total += bid.amount;
        }

        total / (bids.len() as i128)
    }

    /// Calculate bid frequency (bids per hour, scaled by 1000 for precision)
    fn calculate_bid_frequency(bids: &Vec<Bid>) -> i128 {
        if bids.len() < 2 {
            return 0;
        }

        // Simple frequency calculation
        let first_bid = bids.get(0).expect("Invalid address");
        let last_bid = bids.get(bids.len() - 1).expect("Invalid address");

        if last_bid.placed_at <= first_bid.placed_at {
            return 0;
        }

        let duration_seconds = last_bid.placed_at - first_bid.placed_at;
        let bids_count = bids.len() as i128;
        let duration_hours_scaled = duration_seconds as i128 * 1000 / 3600; // Scale by 1000 for precision

        if duration_hours_scaled == 0 {
            return 0;
        }

        bids_count * 1000 / duration_hours_scaled
    }
}

/// Auction statistics
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionStats {
    pub total_bids: u64,
    pub unique_bidders: u64,
    pub highest_bid: i128,
    pub average_bid: i128,
    pub bid_frequency: i128, // Changed from f64 to i128 for Soroban compatibility
}
