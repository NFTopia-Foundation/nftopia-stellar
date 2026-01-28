use soroban_sdk::{Env, Map, Vec, Symbol, Address, symbol_short};
use crate::types::Dispute;
use crate::error::SettlementError;

// Storage keys
pub const DISPUTES: Symbol = symbol_short!("disputes");
pub const NEXT_DISPUTE_ID: Symbol = symbol_short!("next_disp");

/// Storage manager for disputes
pub struct DisputeStore;

impl DisputeStore {
    /// Get the next available dispute ID
    pub fn next_id(env: &Env) -> u64 {
        let current_id: u64 = env.storage().instance().get(&NEXT_DISPUTE_ID).unwrap_or(1);
        let next_id = current_id + 1;
        env.storage().instance().set(&NEXT_DISPUTE_ID, &next_id);
        current_id
    }

    /// Store a dispute
    pub fn put(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        let mut disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .unwrap_or(Map::new(env));

        disputes.set(dispute.dispute_id, dispute.clone());
        env.storage().instance().set(&DISPUTES, &disputes);
        Ok(())
    }

    /// Get a dispute by ID
    pub fn get(env: &Env, dispute_id: u64) -> Result<Dispute, SettlementError> {
        let disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .ok_or(SettlementError::DisputeNotFound)?;

        disputes
            .get(dispute_id)
            .ok_or(SettlementError::DisputeNotFound)
    }

    /// Update a dispute
    pub fn update(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        Self::put(env, dispute)
    }

    /// Remove a dispute
    pub fn remove(env: &Env, dispute_id: u64) -> Result<(), SettlementError> {
        let mut disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .ok_or(SettlementError::DisputeNotFound)?;

        disputes.remove(dispute_id);
        env.storage().instance().set(&DISPUTES, &disputes);
        Ok(())
    }

    /// Get disputes by transaction ID
    pub fn get_by_transaction(env: &Env, transaction_id: u64) -> Vec<Dispute> {
        let disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, dispute) in disputes.iter() {
            if dispute.transaction_id == transaction_id {
                result.push_back(dispute);
            }
        }
        result
    }

    /// Get disputes by auction ID
    pub fn get_by_auction(env: &Env, auction_id: u64) -> Vec<Dispute> {
        let disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, dispute) in disputes.iter() {
            if let Some(aid) = dispute.auction_id {
                if aid == auction_id {
                    result.push_back(dispute);
                }
            }
        }
        result
    }

    /// Get disputes by initiator
    pub fn get_by_initiator(env: &Env, initiator: &Address) -> Vec<Dispute> {
        let disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, dispute) in disputes.iter() {
            if &dispute.initiator == initiator {
                result.push_back(dispute);
            }
        }
        result
    }

    /// Get active disputes (not resolved)
    pub fn get_active(env: &Env) -> Vec<Dispute> {
        let disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, dispute) in disputes.iter() {
            if dispute.resolved_at == 0 {
                result.push_back(dispute);
            }
        }
        result
    }

    /// Get resolved disputes
    pub fn get_resolved(env: &Env) -> Vec<Dispute> {
        let disputes: Map<u64, Dispute> = env
            .storage()
            .instance()
            .get(&DISPUTES)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, dispute) in disputes.iter() {
            if dispute.resolved_at != 0 {
                result.push_back(dispute);
            }
        }
        result
    }

    /// Check if a dispute exists for a transaction
    pub fn exists_for_transaction(env: &Env, transaction_id: u64) -> bool {
        !Self::get_by_transaction(env, transaction_id).is_empty()
    }

    /// Check if a dispute exists for an auction
    pub fn exists_for_auction(env: &Env, auction_id: u64) -> bool {
        !Self::get_by_auction(env, auction_id).is_empty()
    }
}