use crate::error::SettlementError;
use crate::error::{
    DISPUTE_RESOLUTION_CANCEL_TRANSACTION, DISPUTE_RESOLUTION_NOT_RESOLVED,
    DISPUTE_RESOLUTION_REFUND_BUYER, DISPUTE_RESOLUTION_RELEASE_TO_SELLER,
    DISPUTE_RESOLUTION_SPLIT_FUNDS,
};
use crate::events::{
    emit_arbitration_timeout, emit_cancel_transaction, emit_dispute_created,
    emit_dispute_resolved, emit_dispute_vote, emit_oracle_resolution, emit_refund_buyer,
    emit_release_to_seller, emit_split_funds, ArbitrationTimeoutEvent, CancelTransactionEvent,
    DisputeCreatedEvent, DisputeResolvedEvent, DisputeVoteEvent, OracleResolutionEvent,
    RefundBuyerEvent, ReleaseToSellerEvent, SplitFundsEvent,
};
use crate::storage::auction_store::AuctionStore;
use crate::storage::dispute_store::DisputeStore;
use crate::storage::transaction_store::SaleTransactionStore;
use crate::types::{AdminConfig, Asset, Dispute, TransactionState};
use soroban_sdk::{
    contracttype, symbol_short, token, Address, Bytes, Env, Map, Symbol, Vec,
};

const ARBITRATORS: Symbol = symbol_short!("arbiters");
const DISPUTE_CONFIG: Symbol = symbol_short!("dsp_cfg");
const ADMIN_CONFIG: Symbol = symbol_short!("admin_cfg");
const ORACLE_RESOLUTIONS: Symbol = symbol_short!("orc_rslv");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeConfig {
    pub arbitration_quorum: u64,
    pub cooling_period: u64,
    pub evidence_submission_period: u64,
    pub max_arbitrators_per_dispute: u64,
    pub min_arbitrator_reputation: u64,
    pub arbitration_timeout: u64,
    pub auto_resolve_enabled: bool,
    pub default_resolution: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Arbitrator {
    pub address: Address,
    pub reputation_score: u64,
    pub disputes_handled: u64,
    pub successful_resolutions: u64,
    pub is_active: u64,
    pub registered_at: u64,
}

pub struct DisputeResolutionManager;

impl DisputeResolutionManager {
    // -----------------------------------------------------------------------
    // Dispute Initiation
    // -----------------------------------------------------------------------

    pub fn initiate_dispute(
        env: &Env,
        transaction_id: u64,
        auction_id: Option<u64>,
        initiator: &Address,
        reason: &Bytes,
        evidence_uri: Option<Bytes>,
    ) -> Result<u64, SettlementError> {
        if DisputeStore::exists_for_transaction(env, transaction_id) {
            return Err(SettlementError::AlreadyExists);
        }

        if let Some(aid) = auction_id {
            if DisputeStore::exists_for_auction(env, aid) {
                return Err(SettlementError::AlreadyExists);
            }
        }

        let config = Self::get_dispute_config(env)?;

        let arbitrators = Self::select_arbitrators(env, &config)?;

        if arbitrators.is_empty() {
            return Err(SettlementError::InsufficientArbitrators);
        }

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

    // -----------------------------------------------------------------------
    // Voting
    // -----------------------------------------------------------------------

    pub fn vote_on_dispute(
        env: &Env,
        dispute_id: u64,
        arbitrator: &Address,
        vote: u64,
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }

        if !dispute.arbitrators.contains(arbitrator.clone()) {
            return Err(SettlementError::Unauthorized);
        }

        if dispute.votes.contains_key(arbitrator.clone()) {
            return Err(SettlementError::AlreadyExists);
        }

        dispute.votes.set(arbitrator.clone(), vote);
        DisputeStore::update(env, &dispute)?;

        let event = DisputeVoteEvent {
            dispute_id,
            arbitrator: arbitrator.clone(),
            vote,
            timestamp: env.ledger().timestamp(),
        };
        emit_dispute_vote(env, event);

        Self::try_resolve_dispute(env, &mut dispute)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Evidence
    // -----------------------------------------------------------------------

    pub fn submit_evidence(
        env: &Env,
        dispute_id: u64,
        submitter: &Address,
        evidence_uri: &Bytes,
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        let is_authorized =
            dispute.initiator == *submitter || dispute.arbitrators.contains(submitter.clone());

        if !is_authorized {
            return Err(SettlementError::Unauthorized);
        }

        let config = Self::get_dispute_config(env)?;
        let evidence_deadline = dispute.created_at + config.evidence_submission_period;

        if env.ledger().timestamp() > evidence_deadline {
            return Err(SettlementError::Expired);
        }

        dispute.evidence_uri = Some(evidence_uri.clone());
        DisputeStore::update(env, &dispute)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Oracle Resolution
    // -----------------------------------------------------------------------

    pub fn submit_oracle_resolution(
        env: &Env,
        dispute_id: u64,
        oracle: &Address,
        resolution: u64,
    ) -> Result<(), SettlementError> {
        let admin_config = Self::get_admin_config(env)?;

        let expected_oracle = admin_config
            .oracle_address
            .ok_or(SettlementError::Unauthorized)?;

        if oracle != &expected_oracle {
            return Err(SettlementError::Unauthorized);
        }

        oracle.require_auth();

        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }

        let mut resolved: Map<u64, u64> = env
            .storage()
            .instance()
            .get(&ORACLE_RESOLUTIONS)
            .unwrap_or_else(|| Map::new(env));

        if resolved.contains_key(dispute_id) {
            return Err(SettlementError::AlreadyExists);
        }

        resolved.set(dispute_id, resolution);
        env.storage()
            .instance()
            .set(&ORACLE_RESOLUTIONS, &resolved);

        dispute.resolution = resolution;
        dispute.resolved_at = env.ledger().timestamp();
        DisputeStore::update(env, &dispute)?;

        Self::update_arbitrator_reputations(env, &dispute, true)?;

        let event = DisputeResolvedEvent {
            dispute_id,
            resolution,
            winning_votes: 0,
            total_votes: 0,
            timestamp: dispute.resolved_at,
        };
        emit_dispute_resolved(env, event);

        let oracle_event = OracleResolutionEvent {
            dispute_id,
            transaction_id: dispute.transaction_id,
            oracle: oracle.clone(),
            resolution,
            timestamp: dispute.resolved_at,
        };
        emit_oracle_resolution(env, oracle_event);

        Self::execute_resolution(env, &dispute)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Force Resolve (Admin)
    // -----------------------------------------------------------------------

    pub fn force_resolve_dispute(
        env: &Env,
        dispute_id: u64,
        resolution: u64,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        let admin_config = Self::get_admin_config(env)?;

        if !admin_config.admin_list.contains(admin.clone()) {
            return Err(SettlementError::NotAdmin);
        }

        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }

        if resolution != DISPUTE_RESOLUTION_REFUND_BUYER
            && resolution != DISPUTE_RESOLUTION_RELEASE_TO_SELLER
            && resolution != DISPUTE_RESOLUTION_SPLIT_FUNDS
            && resolution != DISPUTE_RESOLUTION_CANCEL_TRANSACTION
        {
            return Err(SettlementError::InvalidState);
        }

        dispute.resolution = resolution;
        dispute.resolved_at = env.ledger().timestamp();

        DisputeStore::update(env, &dispute)?;

        Self::update_arbitrator_reputations(env, &dispute, true)?;

        let event = DisputeResolvedEvent {
            dispute_id,
            resolution,
            winning_votes: 0,
            total_votes: 0,
            timestamp: dispute.resolved_at,
        };
        emit_dispute_resolved(env, event);

        Self::execute_resolution(env, &dispute)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Resolution Execution
    // -----------------------------------------------------------------------

    pub fn execute_dispute_resolution(
        env: &Env,
        dispute_id: u64,
        _executor: &Address,
    ) -> Result<(), SettlementError> {
        let dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at == 0 || dispute.resolution == 0 {
            return Err(SettlementError::InvalidState);
        }

        Self::execute_resolution(env, &dispute)
    }

    fn execute_resolution(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        match dispute.resolution {
            DISPUTE_RESOLUTION_REFUND_BUYER => {
                Self::execute_refund_buyer(env, dispute)?;
            }
            DISPUTE_RESOLUTION_RELEASE_TO_SELLER => {
                Self::execute_release_to_seller(env, dispute)?;
            }
            DISPUTE_RESOLUTION_SPLIT_FUNDS => {
                Self::execute_split_funds(env, dispute)?;
            }
            DISPUTE_RESOLUTION_CANCEL_TRANSACTION => {
                Self::execute_cancel_transaction(env, dispute)?;
            }
            _ => return Err(SettlementError::InvalidState),
        }

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Timeout / Auto-Resolution
    // -----------------------------------------------------------------------

    pub fn check_dispute_timeout(
        env: &Env,
        dispute_id: u64,
    ) -> Result<(), SettlementError> {
        let config = Self::get_dispute_config(env)?;

        if !config.auto_resolve_enabled {
            return Err(SettlementError::InvalidState);
        }

        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }

        let current_time = env.ledger().timestamp();
        let deadline = dispute.created_at + config.arbitration_timeout;

        if current_time < deadline {
            return Err(SettlementError::ArbitrationTimeout);
        }

        dispute.resolution = config.default_resolution;
        dispute.resolved_at = current_time;
        DisputeStore::update(env, &dispute)?;

        let event = DisputeResolvedEvent {
            dispute_id,
            resolution: dispute.resolution,
            winning_votes: dispute.votes.len() as u64,
            total_votes: dispute.required_votes,
            timestamp: current_time,
        };
        emit_dispute_resolved(env, event);

        let timeout_event = ArbitrationTimeoutEvent {
            dispute_id,
            transaction_id: dispute.transaction_id,
            default_resolution: dispute.resolution,
            timestamp: current_time,
        };
        emit_arbitration_timeout(env, timeout_event);

        Self::execute_resolution(env, &dispute)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Fund Execution Methods
    // -----------------------------------------------------------------------

    fn execute_refund_buyer(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        let (buyer, amount, currency) = Self::resolve_escrow_parties(env, dispute)?;

        if amount <= 0 {
            return Err(SettlementError::NotFound);
        }

        let token_client = token::Client::new(env, &currency.contract);
        let contract_address = env.current_contract_address();

        let contract_balance = token_client.balance(&contract_address);
        if contract_balance < amount {
            return Err(SettlementError::PaymentFailed);
        }

        token_client.transfer(&contract_address, &buyer, &amount);

        if let Some(aid) = dispute.auction_id {
            if let Ok(auction) = AuctionStore::get(env, aid) {
                let mut updated = auction;
                updated.state = TransactionState::Resolved;
                AuctionStore::update(env, &updated)?;
            }
        } else {
            if let Ok(mut sale) = SaleTransactionStore::get(env, dispute.transaction_id) {
                sale.state = TransactionState::Cancelled;
                SaleTransactionStore::update(env, &sale)?;
            }
        }

        let event = RefundBuyerEvent {
            dispute_id: dispute.dispute_id,
            transaction_id: dispute.transaction_id,
            buyer,
            amount,
            currency: currency.clone(),
            timestamp: env.ledger().timestamp(),
        };
        emit_refund_buyer(env, event);

        Ok(())
    }

    fn execute_release_to_seller(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        let (_, amount, currency) = Self::resolve_escrow_parties(env, dispute)?;

        if amount <= 0 {
            return Err(SettlementError::NotFound);
        }

        let seller = if let Some(aid) = dispute.auction_id {
            let auction = AuctionStore::get(env, aid)?;
            auction.seller
        } else {
            let sale = SaleTransactionStore::get(env, dispute.transaction_id)?;
            sale.seller
        };

        let token_client = token::Client::new(env, &currency.contract);
        let contract_address = env.current_contract_address();

        let contract_balance = token_client.balance(&contract_address);
        if contract_balance < amount {
            return Err(SettlementError::PaymentFailed);
        }

        token_client.transfer(&contract_address, &seller, &amount);

        if let Some(aid) = dispute.auction_id {
            let mut auction = AuctionStore::get(env, aid)?;
            auction.state = TransactionState::Executed;
            AuctionStore::update(env, &auction)?;
        } else {
            let mut sale = SaleTransactionStore::get(env, dispute.transaction_id)?;
            sale.state = TransactionState::Executed;
            SaleTransactionStore::update(env, &sale)?;
        }

        let event = ReleaseToSellerEvent {
            dispute_id: dispute.dispute_id,
            transaction_id: dispute.transaction_id,
            seller,
            amount,
            currency: currency.clone(),
            timestamp: env.ledger().timestamp(),
        };
        emit_release_to_seller(env, event);

        Ok(())
    }

    fn execute_split_funds(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        let (buyer, amount, currency) = Self::resolve_escrow_parties(env, dispute)?;

        if amount <= 0 {
            return Err(SettlementError::NotFound);
        }

        let seller = if let Some(aid) = dispute.auction_id {
            let auction = AuctionStore::get(env, aid)?;
            auction.seller
        } else {
            let sale = SaleTransactionStore::get(env, dispute.transaction_id)?;
            sale.seller
        };

        let buyer_amount = amount / 2;
        let seller_amount = amount - buyer_amount;

        let token_client = token::Client::new(env, &currency.contract);
        let contract_address = env.current_contract_address();

        let contract_balance = token_client.balance(&contract_address);
        if contract_balance < amount {
            return Err(SettlementError::PaymentFailed);
        }

        if buyer_amount > 0 {
            token_client.transfer(&contract_address, &buyer, &buyer_amount);
        }
        if seller_amount > 0 {
            token_client.transfer(&contract_address, &seller, &seller_amount);
        }

        if let Some(aid) = dispute.auction_id {
            let mut auction = AuctionStore::get(env, aid)?;
            auction.state = TransactionState::Resolved;
            AuctionStore::update(env, &auction)?;
        } else {
            let mut sale = SaleTransactionStore::get(env, dispute.transaction_id)?;
            sale.state = TransactionState::Resolved;
            SaleTransactionStore::update(env, &sale)?;
        }

        let event = SplitFundsEvent {
            dispute_id: dispute.dispute_id,
            transaction_id: dispute.transaction_id,
            buyer_amount,
            seller_amount,
            currency: currency.clone(),
            timestamp: env.ledger().timestamp(),
        };
        emit_split_funds(env, event);

        Ok(())
    }

    fn execute_cancel_transaction(env: &Env, dispute: &Dispute) -> Result<(), SettlementError> {
        let (buyer, amount, currency) = Self::resolve_escrow_parties(env, dispute)?;

        if amount > 0 {
            let token_client = token::Client::new(env, &currency.contract);
            let contract_address = env.current_contract_address();

            let contract_balance = token_client.balance(&contract_address);
            if contract_balance < amount {
                return Err(SettlementError::PaymentFailed);
            }

            token_client.transfer(&contract_address, &buyer, &amount);
        }

        if let Some(aid) = dispute.auction_id {
            let mut auction = AuctionStore::get(env, aid)?;
            auction.state = TransactionState::Cancelled;
            AuctionStore::update(env, &auction)?;
        } else {
            let mut sale = SaleTransactionStore::get(env, dispute.transaction_id)?;
            sale.state = TransactionState::Cancelled;
            SaleTransactionStore::update(env, &sale)?;
        }

        let event = CancelTransactionEvent {
            dispute_id: dispute.dispute_id,
            transaction_id: dispute.transaction_id,
            refunded_to: buyer,
            amount,
            currency: currency.clone(),
            timestamp: env.ledger().timestamp(),
        };
        emit_cancel_transaction(env, event);

        Ok(())
    }

    fn resolve_escrow_parties(
        env: &Env,
        dispute: &Dispute,
    ) -> Result<(Address, i128, Asset), SettlementError> {
        if let Some(aid) = dispute.auction_id {
            let auction = AuctionStore::get(env, aid)?;
            let buyer = auction
                .highest_bidder
                .clone()
                .unwrap_or(dispute.initiator.clone());
            let amount = auction.highest_bid;
            let currency = auction.currency.clone();
            Ok((buyer, amount, currency))
        } else {
            let sale = SaleTransactionStore::get(env, dispute.transaction_id)?;
            let buyer = sale
                .buyer
                .clone()
                .unwrap_or(dispute.initiator.clone());
            let amount = sale.price;
            let currency = sale.currency.clone();
            Ok((buyer, amount, currency))
        }
    }

    // -----------------------------------------------------------------------
    // Arbitrator Management
    // -----------------------------------------------------------------------

    pub fn register_arbitrator(
        env: &Env,
        arbitrator: &Address,
        initial_reputation: u64,
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

    pub fn update_arbitrator_reputation(
        env: &Env,
        arbitrator: &Address,
        reputation_change: i32,
    ) -> Result<(), SettlementError> {
        let mut arb = Self::get_arbitrator(env, arbitrator)?;

        let new_reputation = if reputation_change > 0 {
            arb.reputation_score
                .saturating_add(reputation_change as u64)
        } else {
            arb.reputation_score
                .saturating_sub((-reputation_change) as u64)
        };

        arb.reputation_score = new_reputation;
        Self::store_arbitrator(env, &arb)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------------

    pub fn get_dispute_config(env: &Env) -> Result<DisputeConfig, SettlementError> {
        env.storage()
            .instance()
            .get(&DISPUTE_CONFIG)
            .ok_or(SettlementError::NotFound)
    }

    pub fn update_dispute_config(
        env: &Env,
        config: &DisputeConfig,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        let admin_config = Self::get_admin_config(env)?;
        if !admin_config.admin_list.contains(admin.clone()) {
            return Err(SettlementError::NotAdmin);
        }
        env.storage().instance().set(&DISPUTE_CONFIG, config);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    fn try_resolve_dispute(env: &Env, dispute: &mut Dispute) -> Result<(), SettlementError> {
        let total_votes = dispute.votes.len();
        if (total_votes as u64) < dispute.required_votes {
            return Ok(());
        }

        let mut votes_for = 0u64;
        let mut votes_against = 0u64;
        for (_, vote_value) in dispute.votes.iter() {
            if vote_value == 1 {
                votes_for += 1;
            } else {
                votes_against += 1;
            }
        }

        let resolution = if votes_for > votes_against {
            DISPUTE_RESOLUTION_REFUND_BUYER
        } else {
            DISPUTE_RESOLUTION_RELEASE_TO_SELLER
        };

        dispute.resolution = resolution;
        dispute.resolved_at = env.ledger().timestamp();

        DisputeStore::update(env, dispute)?;

        Self::update_arbitrator_reputations(env, dispute, true)?;

        let event = DisputeResolvedEvent {
            dispute_id: dispute.dispute_id,
            resolution,
            winning_votes: votes_for,
            total_votes: total_votes as u64,
            timestamp: dispute.resolved_at,
        };
        emit_dispute_resolved(env, event);

        Self::execute_resolution(env, dispute)?;

        Ok(())
    }

    fn select_arbitrators(
        env: &Env,
        config: &DisputeConfig,
    ) -> Result<Vec<Address>, SettlementError> {
        let all_arbitrators = Self::get_all_arbitrators(env)?;

        if all_arbitrators.is_empty() {
            return Ok(Vec::new(env));
        }

        let mut eligible: Vec<Arbitrator> = Vec::new(env);
        for arb in all_arbitrators.iter() {
            if arb.is_active == 1 && arb.reputation_score >= config.min_arbitrator_reputation {
                eligible.push_back(arb);
            }
        }

        if eligible.is_empty() {
            return Ok(Vec::new(env));
        }

        let mut selected = Vec::new(env);
        let max = config.max_arbitrators_per_dispute.min(eligible.len() as u64);
        let mut total_weight: u64 = 0;

        for arb in eligible.iter() {
            total_weight = total_weight.saturating_add(arb.reputation_score);
        }

        if total_weight == 0 {
            for i in 0..max {
                if let Some(arb) = eligible.get(i as u32) {
                    selected.push_back(arb.address.clone());
                }
            }
            return Ok(selected);
        }

        let seed = env.ledger().sequence();
        let mut used = Vec::new(env);

        while (selected.len() as u64) < max {
            let rand = (seed.wrapping_mul(selected.len() as u32 + 1))
                .wrapping_add(env.ledger().timestamp() as u32);
            let mut cumulative: u64 = 0;
            let pick = rand as u64 % total_weight;

            for arb in eligible.iter() {
                if used.contains(&arb.address) {
                    continue;
                }
                cumulative = cumulative.saturating_add(arb.reputation_score);
                if cumulative >= pick || cumulative == total_weight {
                    selected.push_back(arb.address.clone());
                    used.push_back(arb.address.clone());
                    break;
                }
            }
        }

        Ok(selected)
    }

    fn update_arbitrator_reputations(
        env: &Env,
        dispute: &Dispute,
        successful_resolution: bool,
    ) -> Result<(), SettlementError> {
        for arbitrator in dispute.arbitrators.iter() {
            let mut arb = Self::get_arbitrator(env, &arbitrator)?;
            arb.disputes_handled += 1;

            if successful_resolution {
                arb.successful_resolutions += 1;
            }

            let success_rate = (arb.successful_resolutions * 100)
                .checked_div(arb.disputes_handled)
                .unwrap_or(100);

            arb.reputation_score = success_rate;

            Self::store_arbitrator(env, &arb)?;
        }

        Ok(())
    }

    fn get_all_arbitrators(env: &Env) -> Result<Vec<Arbitrator>, SettlementError> {
        let arbitrators: Map<Address, Arbitrator> = env
            .storage()
            .instance()
            .get(&ARBITRATORS)
            .unwrap_or_else(|| Map::new(env));

        let mut result = Vec::new(env);
        for (_, arb) in arbitrators.iter() {
            result.push_back(arb);
        }

        Ok(result)
    }

    fn get_arbitrator(env: &Env, address: &Address) -> Result<Arbitrator, SettlementError> {
        let arbitrators: Map<Address, Arbitrator> = env
            .storage()
            .instance()
            .get(&ARBITRATORS)
            .unwrap_or_else(|| Map::new(env));

        Ok(arbitrators.get(address.clone()).unwrap_or(Arbitrator {
            address: address.clone(),
            reputation_score: 1000,
            disputes_handled: 0,
            successful_resolutions: 0,
            is_active: 1,
            registered_at: env.ledger().timestamp(),
        }))
    }

    fn store_arbitrator(env: &Env, arbitrator: &Arbitrator) -> Result<(), SettlementError> {
        let mut arbitrators: Map<Address, Arbitrator> = env
            .storage()
            .instance()
            .get(&ARBITRATORS)
            .unwrap_or_else(|| Map::new(env));

        arbitrators.set(arbitrator.address.clone(), arbitrator.clone());
        env.storage().instance().set(&ARBITRATORS, &arbitrators);

        Ok(())
    }

    fn get_admin_config(env: &Env) -> Result<AdminConfig, SettlementError> {
        env.storage()
            .instance()
            .get(&ADMIN_CONFIG)
            .ok_or(SettlementError::Unauthorized)
    }

    // -----------------------------------------------------------------------
    // Admin Management
    // -----------------------------------------------------------------------

    pub fn set_oracle_address(
        env: &Env,
        admin: &Address,
        oracle: &Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        let mut admin_config = Self::get_admin_config(env)?;
        if !admin_config.admin_list.contains(admin.clone()) {
            return Err(SettlementError::NotAdmin);
        }

        admin_config.oracle_address = Some(oracle.clone());
        env.storage()
            .instance()
            .set(&ADMIN_CONFIG, &admin_config);

        Ok(())
    }

    pub fn add_admin(
        env: &Env,
        admin: &Address,
        new_admin: &Address,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        let mut admin_config = Self::get_admin_config(env)?;
        if !admin_config.admin_list.contains(admin.clone()) {
            return Err(SettlementError::NotAdmin);
        }

        if !admin_config.admin_list.contains(new_admin.clone()) {
            admin_config.admin_list.push_back(new_admin.clone());
            env.storage()
                .instance()
                .set(&ADMIN_CONFIG, &admin_config);
        }

        Ok(())
    }
}

impl Default for DisputeConfig {
    fn default() -> Self {
        Self {
            arbitration_quorum: 3,
            cooling_period: 86400,
            evidence_submission_period: 604800,
            max_arbitrators_per_dispute: 5,
            min_arbitrator_reputation: 50,
            arbitration_timeout: 1209600,
            auto_resolve_enabled: true,
            default_resolution: DISPUTE_RESOLUTION_REFUND_BUYER,
        }
    }
}

pub struct DisputeEvidenceManager;

impl DisputeEvidenceManager {
    pub fn store_evidence(
        _env: &Env,
        _dispute_id: u64,
        _evidence_data: &Vec<u8>,
        _submitter: &Address,
    ) -> Result<(), SettlementError> {
        Ok(())
    }

    pub fn get_evidence(env: &Env, _dispute_id: u64) -> Result<Vec<Bytes>, SettlementError> {
        Ok(Vec::new(env))
    }

    pub fn validate_evidence(evidence: &Vec<u8>) -> Result<(), SettlementError> {
        if evidence.len() > 10000 {
            return Err(SettlementError::InvalidAmount);
        }
        Ok(())
    }
}