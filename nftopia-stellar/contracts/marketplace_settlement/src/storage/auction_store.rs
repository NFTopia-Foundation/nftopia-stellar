use soroban_sdk::{Env, Map, Vec, Symbol, Address, symbol_short};
use crate::types::{AuctionTransaction, Bid, DutchAuctionData};
use crate::error::SettlementError;

// Storage keys
pub const AUCTIONS: Symbol = symbol_short!("auctions");
pub const AUCTION_BIDS: Symbol = symbol_short!("auc_bids");
pub const DUTCH_AUCTIONS: Symbol = symbol_short!("dutch_auc");
pub const NEXT_AUCTION_ID: Symbol = symbol_short!("next_auc");

/// Storage manager for auction transactions
pub struct AuctionStore;

impl AuctionStore {
    /// Get the next available auction ID
    pub fn next_id(env: &Env) -> u64 {
        let current_id: u64 = env.storage().instance().get(&NEXT_AUCTION_ID).unwrap_or(1);
        let next_id = current_id + 1;
        env.storage().instance().set(&NEXT_AUCTION_ID, &next_id);
        current_id
    }

    /// Store an auction transaction
    pub fn put(env: &Env, auction: &AuctionTransaction) -> Result<(), SettlementError> {
        let mut auctions: Map<u64, AuctionTransaction> = env
            .storage()
            .instance()
            .get(&AUCTIONS)
            .unwrap_or(Map::new(env));

        auctions.set(auction.auction_id, auction.clone());
        env.storage().instance().set(&AUCTIONS, &auctions);
        Ok(())
    }

    /// Get an auction by ID
    pub fn get(env: &Env, auction_id: u64) -> Result<AuctionTransaction, SettlementError> {
        let auctions: Map<u64, AuctionTransaction> = env
            .storage()
            .instance()
            .get(&AUCTIONS)
            .ok_or(SettlementError::AuctionNotFound)?;

        auctions
            .get(auction_id)
            .ok_or(SettlementError::AuctionNotFound)
    }

    /// Update an auction
    pub fn update(env: &Env, auction: &AuctionTransaction) -> Result<(), SettlementError> {
        Self::put(env, auction)
    }

    /// Remove an auction
    pub fn remove(env: &Env, auction_id: u64) -> Result<(), SettlementError> {
        let mut auctions: Map<u64, AuctionTransaction> = env
            .storage()
            .instance()
            .get(&AUCTIONS)
            .ok_or(SettlementError::AuctionNotFound)?;

        auctions.remove(auction_id);
        env.storage().instance().set(&AUCTIONS, &auctions);
        Ok(())
    }

    /// Get all active auctions
    pub fn get_active(env: &Env) -> Vec<AuctionTransaction> {
        let auctions: Map<u64, AuctionTransaction> = env
            .storage()
            .instance()
            .get(&AUCTIONS)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        let current_time = env.ledger().timestamp();

        for (_, auction) in auctions.iter() {
            if auction.end_time > current_time && auction.state == crate::types::TransactionState::Pending {
                result.push_back(auction);
            }
        }
        result
    }

    /// Get auctions by seller
    pub fn get_by_seller(env: &Env, seller: &Address) -> Vec<AuctionTransaction> {
        let auctions: Map<u64, AuctionTransaction> = env
            .storage()
            .instance()
            .get(&AUCTIONS)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, auction) in auctions.iter() {
            if &auction.seller == seller {
                result.push_back(auction);
            }
        }
        result
    }

    /// Add a bid to an auction
    pub fn add_bid(env: &Env, auction_id: u64, bid: &Bid) -> Result<(), SettlementError> {
        let mut all_bids: Map<u64, Vec<Bid>> = env
            .storage()
            .instance()
            .get(&AUCTION_BIDS)
            .unwrap_or(Map::new(env));

        let mut auction_bids = all_bids.get(auction_id).unwrap_or(Vec::new(env));
        auction_bids.push_back(bid.clone());

        all_bids.set(auction_id, auction_bids);
        env.storage().instance().set(&AUCTION_BIDS, &all_bids);
        Ok(())
    }

    /// Get all bids for an auction
    pub fn get_bids(env: &Env, auction_id: u64) -> Vec<Bid> {
        let all_bids: Map<u64, Vec<Bid>> = env
            .storage()
            .instance()
            .get(&AUCTION_BIDS)
            .unwrap_or(Map::new(env));

        all_bids.get(auction_id).unwrap_or(Vec::new(env))
    }

    /// Update a bid in an auction (for committed bids)
    pub fn update_bid(env: &Env, auction_id: u64, bidder: &Address, new_bid: &Bid) -> Result<(), SettlementError> {
        let mut all_bids: Map<u64, Vec<Bid>> = env
            .storage()
            .instance()
            .get(&AUCTION_BIDS)
            .unwrap_or(Map::new(env));

        let mut auction_bids = all_bids.get(auction_id).unwrap_or(Vec::new(env));

        // Find and update the bid
        let mut found = false;
        for i in 0..auction_bids.len() {
            if let Some(existing_bid) = auction_bids.get(i) {
                if existing_bid.bidder == *bidder {
                    auction_bids.set(i, new_bid.clone());
                    found = true;
                    break;
                }
            }
        }

        if !found {
            return Err(SettlementError::NotFound);
        }

        all_bids.set(auction_id, auction_bids);
        env.storage().instance().set(&AUCTION_BIDS, &all_bids);
        Ok(())
    }
}

/// Storage manager for Dutch auction data
pub struct DutchAuctionStore;

impl DutchAuctionStore {
    /// Store Dutch auction data
    pub fn put(env: &Env, auction_id: u64, data: &DutchAuctionData) -> Result<(), SettlementError> {
        let mut dutch_auctions: Map<u64, DutchAuctionData> = env
            .storage()
            .instance()
            .get(&DUTCH_AUCTIONS)
            .unwrap_or(Map::new(env));

        dutch_auctions.set(auction_id, data.clone());
        env.storage().instance().set(&DUTCH_AUCTIONS, &dutch_auctions);
        Ok(())
    }

    /// Get Dutch auction data
    pub fn get(env: &Env, auction_id: u64) -> Result<DutchAuctionData, SettlementError> {
        let dutch_auctions: Map<u64, DutchAuctionData> = env
            .storage()
            .instance()
            .get(&DUTCH_AUCTIONS)
            .ok_or(SettlementError::AuctionNotFound)?;

        dutch_auctions
            .get(auction_id)
            .ok_or(SettlementError::AuctionNotFound)
    }

    /// Update Dutch auction data
    pub fn update(env: &Env, auction_id: u64, data: &DutchAuctionData) -> Result<(), SettlementError> {
        Self::put(env, auction_id, data)
    }

    /// Remove Dutch auction data
    pub fn remove(env: &Env, auction_id: u64) -> Result<(), SettlementError> {
        let mut dutch_auctions: Map<u64, DutchAuctionData> = env
            .storage()
            .instance()
            .get(&DUTCH_AUCTIONS)
            .ok_or(SettlementError::AuctionNotFound)?;

        dutch_auctions.remove(auction_id);
        env.storage().instance().set(&DUTCH_AUCTIONS, &dutch_auctions);
        Ok(())
    }
}