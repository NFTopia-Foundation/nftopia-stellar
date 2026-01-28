use soroban_sdk::{Env, Address, Map, Vec, Symbol, symbol_short, Bytes, contracttype};
use crate::error::SettlementError;
use crate::types::Dispute;
use crate::error::{DISPUTE_RESOLUTION_NOT_RESOLVED, DISPUTE_RESOLUTION_REFUND_BUYER, DISPUTE_RESOLUTION_RELEASE_TO_SELLER, DISPUTE_RESOLUTION_SPLIT_FUNDS, DISPUTE_RESOLUTION_CANCEL_TRANSACTION};
use crate::storage::dispute_store::DisputeStore;
use crate::events::{
    emit_dispute_created, emit_dispute_vote, emit_dispute_resolved,
    DisputeCreatedEvent, DisputeVoteEvent, DisputeResolvedEvent
};

// Storage keys
const ARBITRATORS: Symbol = symbol_short!("arbiters");
const DISPUTE_CONFIG: Symbol = symbol_short!("dsp_cfg");

/// Dispute configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeConfig {
    pub arbitration_quorum: u64,      // Required votes for resolution
    pub cooling_period: u64,          // Cooling period before dispute resolution
    pub evidence_submission_period: u64, // Time allowed for evidence submission
    pub max_arbitrators_per_dispute: u64,
    pub min_arbitrator_reputation: u64,
}

/// Arbitrator information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Arbitrator {
    pub address: Address,
    pub reputation_score: u64,
    pub disputes_handled: u64,
    pub successful_resolutions: u64,
    pub is_active: u64, // 0 = inactive, 1 = active
    pub registered_at: u64,
}

/// Dispute resolution manager
pub struct DisputeResolutionManager;

impl DisputeResolutionManager {
    /// Initiate a dispute
    pub fn initiate_dispute(
        env: &Env,
        transaction_id: u64,
        auction_id: Option<u64>,
        initiator: &Address,
        reason: &Bytes,
        evidence_uri: Option<Bytes>
    ) -> Result<u64, SettlementError> {
        // Check if dispute already exists for this transaction
        if DisputeStore::exists_for_transaction(env, transaction_id) {
            return Err(SettlementError::AlreadyExists);
        }

        if let Some(aid) = auction_id {
            if DisputeStore::exists_for_auction(env, aid) {
                return Err(SettlementError::AlreadyExists);
            }
        }

        // Validate cooling period
        let config = Self::get_dispute_config(env)?;

        // Select arbitrators
        let arbitrators = Self::select_arbitrators(env, &config)?;

        if arbitrators.is_empty() {
            return Err(SettlementError::InsufficientArbitrators);
        }

        // Create dispute
        let dispute_id = DisputeStore::next_id(env);
        let dispute = Dispute {
            dispute_id,
            transaction_id,
            auction_id,
            initiator: initiator.clone(),
            reason: reason.clone(),
            evidence_uri,
            arbitrators: arbitrators.clone(),
            votes: Map::new(env),
            required_votes: config.arbitration_quorum,
            created_at: env.ledger().timestamp(),
            resolved_at: 0,
            resolution: DISPUTE_RESOLUTION_NOT_RESOLVED,
        };

        DisputeStore::put(env, &dispute)?;

        // Emit dispute created event
        let event = DisputeCreatedEvent {
            dispute_id,
            transaction_id,
            auction_id,
            initiator: initiator.clone(),
            reason: reason.clone(),
            arbitrators: arbitrators.clone(),
            timestamp: dispute.created_at,
        };
        emit_dispute_created(env, event);

        Ok(dispute_id)
    }

    /// Submit vote on a dispute
    pub fn vote_on_dispute(
        env: &Env,
        dispute_id: u64,
        arbitrator: &Address,
        vote: u64 // 1 = favor initiator, 0 = against
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        // Check if dispute is still active
        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }

        // Check if arbitrator is assigned to this dispute
        if !dispute.arbitrators.contains(arbitrator.clone()) {
            return Err(SettlementError::Unauthorized);
        }

        // Check if arbitrator already voted
        if dispute.votes.contains_key(arbitrator.clone()) {
            return Err(SettlementError::AlreadyExists);
        }

        // Record vote
        dispute.votes.set(arbitrator.clone(), vote);
        DisputeStore::update(env, &dispute)?;

        // Emit vote event
        let event = DisputeVoteEvent {
            dispute_id,
            arbitrator: arbitrator.clone(),
            vote,
            timestamp: env.ledger().timestamp(),
        };
        emit_dispute_vote(env, event);

        // Check if dispute can be resolved
        Self::try_resolve_dispute(env, &mut dispute)?;

        Ok(())
    }

    /// Submit additional evidence
    pub fn submit_evidence(
        env: &Env,
        dispute_id: u64,
        submitter: &Address,
        evidence_uri: &Bytes
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        // Only initiator or arbitrators can submit evidence
        let is_authorized = dispute.initiator == *submitter ||
                           dispute.arbitrators.contains(submitter.clone());

        if !is_authorized {
            return Err(SettlementError::Unauthorized);
        }

        // Check if still in evidence submission period
        let config = Self::get_dispute_config(env)?;
        let evidence_deadline = dispute.created_at + config.evidence_submission_period;

        if env.ledger().timestamp() > evidence_deadline {
            return Err(SettlementError::Expired);
        }

        dispute.evidence_uri = Some(evidence_uri.clone());
        DisputeStore::update(env, &dispute)?;

        Ok(())
    }

    /// Force resolve dispute (admin function)
    pub fn force_resolve_dispute(
        env: &Env,
        dispute_id: u64,
        resolution: u64,
        _admin: &Address
    ) -> Result<(), SettlementError> {
        // Check admin permissions
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }

        dispute.resolution = resolution;
        dispute.resolved_at = env.ledger().timestamp();

        DisputeStore::update(env, &dispute)?;

        // Update arbitrator reputations
        Self::update_arbitrator_reputations(env, &dispute, true)?;

        // Emit resolution event
        let event = DisputeResolvedEvent {
            dispute_id,
            resolution,
            winning_votes: 0, // Admin resolution
            total_votes: 0,
            timestamp: dispute.resolved_at,
        };
        emit_dispute_resolved(env, event);

        Ok(())
    }

    /// Execute dispute resolution
    pub fn execute_dispute_resolution(
        env: &Env,
        dispute_id: u64,
        _executor: &Address
    ) -> Result<(), SettlementError> {
        let dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at == 0 || dispute.resolution == 0 {
            return Err(SettlementError::InvalidState);
        }

        let resolution = dispute.resolution;

        // Execute resolution based on type
        match resolution {
            DISPUTE_RESOLUTION_REFUND_BUYER => {
                Self::execute_refund_buyer(env, &dispute)?;
            }
            DISPUTE_RESOLUTION_RELEASE_TO_SELLER => {
                Self::execute_release_to_seller(env, &dispute)?;
            }
            DISPUTE_RESOLUTION_SPLIT_FUNDS => {
                Self::execute_split_funds(env, &dispute)?;
            }
            DISPUTE_RESOLUTION_CANCEL_TRANSACTION => {
                Self::execute_cancel_transaction(env, &dispute)?;
            }
            _ => return Err(SettlementError::InvalidState),
        }

        Ok(())
    }

    /// Register as an arbitrator
    pub fn register_arbitrator(
        env: &Env,
        arbitrator: &Address,
        initial_reputation: u64
    ) -> Result<(), SettlementError> {
        let arbitrator_info = Arbitrator {
            address: arbitrator.clone(),
            reputation_score: initial_reputation,
            disputes_handled: 0,
            successful_resolutions: 0,
            is_active: 1,
            registered_at: env.ledger().timestamp(),
        };

        Self::store_arbitrator(env, &arbitrator_info)?;
        Ok(())
    }

    /// Update arbitrator reputation
    pub fn update_arbitrator_reputation(
        env: &Env,
        arbitrator: &Address,
        reputation_change: i32
    ) -> Result<(), SettlementError> {
        let mut arb = Self::get_arbitrator(env, arbitrator)?;

        let new_reputation = if reputation_change > 0 {
            arb.reputation_score.saturating_add(reputation_change as u64)
        } else {
            arb.reputation_score.saturating_sub((-reputation_change) as u64)
        };

        arb.reputation_score = new_reputation;
        Self::store_arbitrator(env, &arb)?;

        Ok(())
    }

    /// Get dispute configuration
    pub fn get_dispute_config(env: &Env) -> Result<DisputeConfig, SettlementError> {
        env.storage()
            .instance()
            .get(&DISPUTE_CONFIG)
            .ok_or(SettlementError::NotFound)
    }

    /// Update dispute configuration
    pub fn update_dispute_config(
        env: &Env,
        config: &DisputeConfig,
        _admin: &Address
    ) -> Result<(), SettlementError> {
        // Check admin permissions
        env.storage().instance().set(&DISPUTE_CONFIG, config);
        Ok(())
    }

    /// Internal: Try to resolve dispute if enough votes
    fn try_resolve_dispute(env: &Env, dispute: &mut Dispute) -> Result<(), SettlementError> {
        let total_votes = dispute.votes.len();
        if (total_votes as u64) < dispute.required_votes {
            return Ok(());
        }

        let mut votes_for_initiator = 0u64;
        for (_, vote_value) in dispute.votes.iter() {
            if vote_value == 1 {
                votes_for_initiator += 1;
            }
        }

        // Simple majority wins
        let resolution = if votes_for_initiator > (total_votes as u64) / 2 {
            DISPUTE_RESOLUTION_REFUND_BUYER
        } else {
            DISPUTE_RESOLUTION_RELEASE_TO_SELLER
        };

        dispute.resolution = resolution;
        dispute.resolved_at = env.ledger().timestamp();

        DisputeStore::update(env, dispute)?;

        // Update arbitrator reputations
        Self::update_arbitrator_reputations(env, dispute, true)?;

        // Emit resolution event
        let event = DisputeResolvedEvent {
            dispute_id: dispute.dispute_id,
            resolution,
            winning_votes: votes_for_initiator,
            total_votes: total_votes as u64,
            timestamp: dispute.resolved_at,
        };
        emit_dispute_resolved(env, event);

        Ok(())
    }

    /// Internal: Select arbitrators for a dispute
    fn select_arbitrators(env: &Env, config: &DisputeConfig) -> Result<Vec<Address>, SettlementError> {
        let all_arbitrators = Self::get_all_arbitrators(env)?;

        if all_arbitrators.is_empty() {
            return Ok(Vec::new(env));
        }

        // Simple selection: take first N active arbitrators with sufficient reputation
        let mut selected = Vec::new(env);

        for arb in all_arbitrators.iter() {
            if arb.is_active == 1 && arb.reputation_score >= config.min_arbitrator_reputation {
                selected.push_back(arb.address.clone());
                if selected.len() as u64 >= config.max_arbitrators_per_dispute {
                    break;
                }
            }
        }

        Ok(selected)
    }

    /// Internal: Update arbitrator reputations after dispute resolution
    fn update_arbitrator_reputations(
        env: &Env,
        dispute: &Dispute,
        successful_resolution: bool
    ) -> Result<(), SettlementError> {
        for arbitrator in dispute.arbitrators.iter() {
            let mut arb = Self::get_arbitrator(env, &arbitrator)?;
            arb.disputes_handled += 1;

            if successful_resolution {
                arb.successful_resolutions += 1;
            }

            // Update reputation based on participation and success rate
            let success_rate = if arb.disputes_handled > 0 {
                (arb.successful_resolutions * 100) / arb.disputes_handled
            } else {
                100
            };

            arb.reputation_score = success_rate;
            Self::store_arbitrator(env, &arb)?;
        }

        Ok(())
    }

    /// Internal: Execute refund to buyer
    fn execute_refund_buyer(_env: &Env, _dispute: &Dispute) -> Result<(), SettlementError> {
        // Implementation would release escrow funds back to buyer
        // This is a placeholder
        Ok(())
    }

    /// Internal: Execute release to seller
    fn execute_release_to_seller(_env: &Env, _dispute: &Dispute) -> Result<(), SettlementError> {
        // Implementation would release escrow funds to seller
        // This is a placeholder
        Ok(())
    }

    /// Internal: Execute fund split
    fn execute_split_funds(_env: &Env, _dispute: &Dispute) -> Result<(), SettlementError> {
        // Implementation would split escrow funds between parties
        // This is a placeholder
        Ok(())
    }

    /// Internal: Execute transaction cancellation
    fn execute_cancel_transaction(_env: &Env, _dispute: &Dispute) -> Result<(), SettlementError> {
        // Implementation would cancel the transaction and refund all parties
        // This is a placeholder
        Ok(())
    }

    /// Internal: Get all arbitrators
    fn get_all_arbitrators(env: &Env) -> Result<Vec<Arbitrator>, SettlementError> {
        let arbitrators: Map<Address, Arbitrator> = env
            .storage()
            .instance()
            .get(&ARBITRATORS)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, arb) in arbitrators.iter() {
            result.push_back(arb);
        }

        Ok(result)
    }

    /// Internal: Get arbitrator by address
    fn get_arbitrator(env: &Env, address: &Address) -> Result<Arbitrator, SettlementError> {
        let arbitrators: Map<Address, Arbitrator> = env
            .storage()
            .instance()
            .get(&ARBITRATORS)
            .unwrap_or(Map::new(env));

        Ok(arbitrators
            .get(address.clone())
            .unwrap_or(Arbitrator {
                address: address.clone(),
                reputation_score: 1000, // Default reputation
                disputes_handled: 0,
                successful_resolutions: 0,
                is_active: 1, // Active by default
                registered_at: env.ledger().timestamp(),
            }))
    }

    /// Internal: Store arbitrator
    fn store_arbitrator(env: &Env, arbitrator: &Arbitrator) -> Result<(), SettlementError> {
        let mut arbitrators: Map<Address, Arbitrator> = env
            .storage()
            .instance()
            .get(&ARBITRATORS)
            .unwrap_or(Map::new(env));

        arbitrators.set(arbitrator.address.clone(), arbitrator.clone());
        env.storage().instance().set(&ARBITRATORS, &arbitrators);

        Ok(())
    }
}

/// Default dispute configuration
impl Default for DisputeConfig {
    fn default() -> Self {
        Self {
            arbitration_quorum: 3,
            cooling_period: 86400, // 24 hours
            evidence_submission_period: 604800, // 7 days
            max_arbitrators_per_dispute: 5,
            min_arbitrator_reputation: 50,
        }
    }
}

/// Dispute evidence manager
pub struct DisputeEvidenceManager;

impl DisputeEvidenceManager {
    /// Store dispute evidence on-chain
    pub fn store_evidence(
        _env: &Env,
        _dispute_id: u64,
        _evidence_data: &Vec<u8>,
        _submitter: &Address
    ) -> Result<(), SettlementError> {

        Ok(())
    }

    /// Get evidence for a dispute
    pub fn get_evidence(env: &Env, _dispute_id: u64) -> Result<Vec<Bytes>, SettlementError> {
        // Placeholder
        Ok(Vec::new(env))
    }

    /// Validate evidence format
    pub fn validate_evidence(evidence: &Vec<u8>) -> Result<(), SettlementError> {
        // Basic validation - check size limits
        if evidence.len() > 10000 { // 10KB limit
            return Err(SettlementError::InvalidAmount);
        }
        Ok(())
    }
}