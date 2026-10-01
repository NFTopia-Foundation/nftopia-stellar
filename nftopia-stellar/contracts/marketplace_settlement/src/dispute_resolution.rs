use crate::atomic_swap::{AtomicSwapEngine, EscrowManager};
use crate::error::SettlementError;
use crate::error::{
    DisputeError, DISPUTE_RESOLUTION_CANCEL_TRANSACTION, DISPUTE_RESOLUTION_NOT_RESOLVED,
    DISPUTE_RESOLUTION_REFUND_BUYER, DISPUTE_RESOLUTION_RELEASE_TO_SELLER,
    DISPUTE_RESOLUTION_SPLIT_FUNDS,
};
use crate::events::{
    emit_dispute_admin_updated, emit_dispute_config_updated, emit_dispute_created,
    emit_dispute_funds_released, emit_dispute_oracle_submitted, emit_dispute_oracle_updated,
    emit_dispute_resolved, emit_dispute_timed_out, emit_dispute_vote, DisputeAdminUpdatedEvent,
    DisputeConfigUpdatedEvent, DisputeCreatedEvent, DisputeFundsReleasedEvent,
    DisputeOracleSubmittedEvent, DisputeOracleUpdatedEvent, DisputeResolvedEvent,
    DisputeTimedOutEvent, DisputeVoteEvent,
};
use crate::royalty_distributor::ADMIN_CONFIG_KEY;
use crate::storage::dispute_store::DisputeStore;
use crate::storage::transaction_store::SaleTransactionStore;
use crate::types::{AdminConfig, Dispute, TransactionState};
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, BytesN, Env, Map, Symbol, Vec};

// Storage keys
const ARBITRATORS: Symbol = symbol_short!("arbiters");
const DISPUTE_CONFIG: Symbol = symbol_short!("dsp_cfg");
/// Additional dispute admins, on top of the primary admin in `AdminConfig`.
const DISPUTE_ADMINS: Symbol = symbol_short!("dsp_adm");
/// Admin-registered arbitration oracles.
const ORACLES: Symbol = symbol_short!("oracles");
/// Entropy mixed into arbitrator selection, rotatable by the admin.
const SELECTION_SEED: Symbol = symbol_short!("arb_seed");

/// Basis-point denominator (100%).
const BPS_DENOMINATOR: u64 = 10_000;

/// Reputation points that buy one extra entry in the arbitrator selection pool.
const REPUTATION_WEIGHT_UNIT: u64 = 1_000;
/// Maximum extra entries a single arbitrator can buy, so one very high-reputation
/// arbitrator cannot crowd out the pool.
const REPUTATION_WEIGHT_CAP: u64 = 4;
/// Hard bound on the weighted selection pool, keeping one dispute's arbitration
/// selection inside the Soroban resource budget as the registry grows.
const MAX_SELECTION_POOL: u32 = 256;

/// Dispute configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeConfig {
    pub arbitration_quorum: u64,         // Required votes for resolution
    pub cooling_period: u64,             // Cooling period before dispute resolution
    pub evidence_submission_period: u64, // Time allowed for evidence submission
    pub max_arbitrators_per_dispute: u64,
    pub min_arbitrator_reputation: u64,
    /// Seconds after `created_at` at which an unresolved dispute auto-resolves to
    /// `default_resolution` because arbitration stalled. 0 disables the timeout.
    pub dispute_timeout: u64,
    /// Share of the escrowed payment returned to the buyer on a `SPLIT_FUNDS`
    /// resolution, in basis points. The remainder goes to the seller.
    pub split_buyer_bps: u64,
    /// Outcome applied when `dispute_timeout` elapses without quorum.
    pub default_resolution: u64,
}

/// A trusted external resolver — a multi-sig account, a DAO, or a decentralized
/// arbitration protocol — authorised to submit binding dispute resolutions.
///
/// Registered by the dispute admin. `public_key` is the ed25519 key whose
/// signature the contract verifies over the canonical decision payload, so a
/// resolution is cryptographically bound to the oracle's key and cannot be
/// replayed against a different dispute (see
/// [`DisputeResolutionManager::oracle_attestation_payload`]).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArbitrationOracle {
    pub address: Address,
    pub public_key: BytesN<32>,
    pub is_active: bool,
    pub registered_at: u64,
    pub resolutions_submitted: u64,
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

/// Who receives what when a dispute's escrow is paid out.
struct PayoutPlan {
    /// Receives `payment_primary_bps` of the escrowed payment.
    payment_primary: Address,
    payment_primary_bps: u64,
    /// Receives the remainder of the escrowed payment.
    payment_secondary: Address,
    /// Receives every escrowed NFT.
    nft_recipient: Address,
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
        evidence_uri: Option<Bytes>,
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
        let arbitrators = Self::select_arbitrators(env, &config, transaction_id)?;

        if arbitrators.is_empty() {
            return Err(DisputeError::NoEligibleArbitrators.into());
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
            settled_at: 0,
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
        vote: u64, // 1 = favor initiator, 0 = against
    ) -> Result<(), SettlementError> {
        if vote > 1 {
            return Err(DisputeError::InvalidVote.into());
        }

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
        evidence_uri: &Bytes,
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        // Only initiator or arbitrators can submit evidence
        let is_authorized =
            dispute.initiator == *submitter || dispute.arbitrators.contains(submitter.clone());

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

    /// Force resolve dispute (admin only)
    ///
    /// The caller must authenticate and must be the primary admin from
    /// `AdminConfig` or an address in the dispute admin registry; any other
    /// address is rejected with `NotAdmin` rather than being trusted on its word.
    ///
    /// The forced resolution is binding and immediately pays out the disputed
    /// escrow, so a force resolution cannot leave funds in limbo.
    pub fn force_resolve_dispute(
        env: &Env,
        dispute_id: u64,
        resolution: u64,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        Self::require_dispute_admin(env, admin)?;
        Self::validate_resolution(resolution)?;

        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }
        if dispute.settled_at != 0 {
            return Err(DisputeError::AlreadySettled.into());
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

        // A force resolution binds the funds too.
        Self::settle_dispute_escrow(env, &mut dispute)
    }

    /// Execute a previously decided resolution, paying out the disputed escrow.
    ///
    /// Callable by anyone: it can only ever do what `dispute.resolution` already
    /// says, and `settled_at` makes it impossible to pay out twice.
    pub fn execute_dispute_resolution(
        env: &Env,
        dispute_id: u64,
        _executor: &Address,
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;
        Self::settle_dispute_escrow(env, &mut dispute)
    }

    /// Resolve a dispute that has stalled past `DisputeConfig::dispute_timeout`.
    ///
    /// Permissionless. Two stalled shapes are handled:
    ///
    /// * Arbitration never reached quorum: the dispute auto-resolves to
    ///   `DisputeConfig::default_resolution` (refund the buyer by default) and
    ///   that outcome is paid out immediately.
    /// * A resolution was decided but nobody executed it: the funds are paid out
    ///   under the existing resolution.
    ///
    /// Returns `InvalidState` while the configured timeout has not elapsed, and
    /// `DisputeAlreadyResolved` once the escrow has been paid out.
    pub fn resolve_dispute_timeout(
        env: &Env,
        dispute_id: u64,
        _caller: &Address,
    ) -> Result<(), SettlementError> {
        let mut dispute = DisputeStore::get(env, dispute_id)?;

        if dispute.settled_at != 0 {
            return Err(DisputeError::AlreadySettled.into());
        }

        let config = Self::get_dispute_config(env)?;
        let deadline = dispute
            .created_at
            .checked_add(config.dispute_timeout)
            .ok_or(SettlementError::Overflow)?;
        let now = env.ledger().timestamp();

        if config.dispute_timeout == 0 || now < deadline {
            return Err(DisputeError::TimeoutNotReached.into());
        }

        if dispute.resolved_at == 0 {
            // Arbitration stalled: apply the configured default outcome.
            dispute.resolution = config.default_resolution;
            dispute.resolved_at = now;
            DisputeStore::update(env, &dispute)?;

            emit_dispute_resolved(
                env,
                DisputeResolvedEvent {
                    dispute_id,
                    resolution: dispute.resolution,
                    winning_votes: 0,
                    total_votes: dispute.votes.len() as u64,
                    timestamp: now,
                },
            );
            emit_dispute_timed_out(
                env,
                DisputeTimedOutEvent {
                    dispute_id,
                    transaction_id: dispute.transaction_id,
                    resolution: dispute.resolution,
                    deadline,
                    timestamp: now,
                },
            );

            // Arbitrators that let the clock run out take a reputation hit.
            Self::update_arbitrator_reputations(env, &dispute, false)?;
        }

        Self::settle_dispute_escrow(env, &mut dispute)
    }

    /// Get a dispute by id (view helper for consumers and tests)
    pub fn get_dispute(env: &Env, dispute_id: u64) -> Result<Dispute, SettlementError> {
        DisputeStore::get(env, dispute_id)
    }

    /// Register as an arbitrator
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

    /// Update arbitrator reputation
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

    /// Get dispute configuration
    pub fn get_dispute_config(env: &Env) -> Result<DisputeConfig, SettlementError> {
        env.storage()
            .instance()
            .get(&DISPUTE_CONFIG)
            .ok_or(SettlementError::NotFound)
    }

    /// Update dispute configuration (admin only)
    ///
    /// The caller must authenticate and be a registered dispute admin; the config
    /// itself is validated before it is stored.
    pub fn update_dispute_config(
        env: &Env,
        config: &DisputeConfig,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        Self::require_dispute_admin(env, admin)?;
        Self::validate_dispute_config(config)?;

        env.storage().instance().set(&DISPUTE_CONFIG, config);

        emit_dispute_config_updated(
            env,
            DisputeConfigUpdatedEvent {
                config: config.clone(),
                updated_by: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    /// Internal: reject a config that would make arbitration or settlement unsafe.
    pub fn validate_dispute_config(config: &DisputeConfig) -> Result<(), SettlementError> {
        if config.arbitration_quorum == 0
            || config.max_arbitrators_per_dispute == 0
            || config.arbitration_quorum > config.max_arbitrators_per_dispute
        {
            return Err(DisputeError::InvalidDisputeConfig.into());
        }
        if config.split_buyer_bps > BPS_DENOMINATOR {
            return Err(DisputeError::InvalidSplitBps.into());
        }
        Self::validate_resolution(config.default_resolution)?;
        Ok(())
    }

    /// Internal: reject a resolution code that is not a known outcome.
    fn validate_resolution(resolution: u64) -> Result<(), SettlementError> {
        match resolution {
            DISPUTE_RESOLUTION_REFUND_BUYER
            | DISPUTE_RESOLUTION_RELEASE_TO_SELLER
            | DISPUTE_RESOLUTION_SPLIT_FUNDS
            | DISPUTE_RESOLUTION_CANCEL_TRANSACTION => Ok(()),
            _ => Err(DisputeError::InvalidResolution.into()),
        }
    }

    // ── Admin registry ───────────────────────────────────────────────────────

    /// Whether `who` may act as a dispute admin.
    ///
    /// The primary admin recorded in `AdminConfig` always qualifies; the dispute
    /// admin registry adds further addresses (a multi-sig or DAO contract, for
    /// example) without giving them control of the whole contract.
    pub fn is_dispute_admin(env: &Env, who: &Address) -> bool {
        if Self::get_dispute_admins(env).contains(who.clone()) {
            return true;
        }
        let primary: Option<AdminConfig> = env.storage().instance().get(&ADMIN_CONFIG_KEY);
        match primary {
            Some(config) => config.admin == *who,
            None => false,
        }
    }

    /// Internal: authenticate `admin` and require it to be a dispute admin.
    fn require_dispute_admin(env: &Env, admin: &Address) -> Result<(), SettlementError> {
        admin.require_auth();
        if !Self::is_dispute_admin(env, admin) {
            return Err(DisputeError::NotAdmin.into());
        }
        Ok(())
    }

    /// Addresses in the dispute admin registry (excludes the primary admin).
    pub fn get_dispute_admins(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DISPUTE_ADMINS)
            .unwrap_or_else(|| Vec::new(env))
    }

    /// Add an address to the dispute admin registry (dispute admin only)
    pub fn add_dispute_admin(
        env: &Env,
        admin: &Address,
        new_admin: &Address,
    ) -> Result<(), SettlementError> {
        Self::require_dispute_admin(env, admin)?;

        let mut admins = Self::get_dispute_admins(env);
        if admins.contains(new_admin.clone()) {
            return Err(SettlementError::AlreadyExists);
        }
        admins.push_back(new_admin.clone());
        env.storage().instance().set(&DISPUTE_ADMINS, &admins);

        emit_dispute_admin_updated(
            env,
            DisputeAdminUpdatedEvent {
                admin: new_admin.clone(),
                added: true,
                updated_by: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    /// Remove an address from the dispute admin registry (dispute admin only)
    ///
    /// The primary admin from `AdminConfig` cannot be removed here; it is not part
    /// of this registry.
    pub fn remove_dispute_admin(
        env: &Env,
        admin: &Address,
        target: &Address,
    ) -> Result<(), SettlementError> {
        Self::require_dispute_admin(env, admin)?;

        let admins = Self::get_dispute_admins(env);
        let mut remaining = Vec::new(env);
        let mut found = false;
        for existing in admins.iter() {
            if existing == *target {
                found = true;
            } else {
                remaining.push_back(existing);
            }
        }
        if !found {
            return Err(SettlementError::NotFound);
        }
        env.storage().instance().set(&DISPUTE_ADMINS, &remaining);

        emit_dispute_admin_updated(
            env,
            DisputeAdminUpdatedEvent {
                admin: target.clone(),
                added: false,
                updated_by: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    // ── Arbitration oracle ───────────────────────────────────────────────────

    /// Register or update an arbitration oracle (dispute admin only)
    ///
    /// `public_key` is the ed25519 key whose signature must accompany every
    /// resolution the oracle submits.
    pub fn register_oracle(
        env: &Env,
        admin: &Address,
        oracle: &Address,
        public_key: &BytesN<32>,
        is_active: bool,
    ) -> Result<(), SettlementError> {
        Self::require_dispute_admin(env, admin)?;

        let mut oracles: Map<Address, ArbitrationOracle> = env
            .storage()
            .instance()
            .get(&ORACLES)
            .unwrap_or(Map::new(env));

        let existing = oracles.get(oracle.clone());
        let registered_at = match &existing {
            Some(record) => record.registered_at,
            None => env.ledger().timestamp(),
        };
        let resolutions_submitted = match &existing {
            Some(record) => record.resolutions_submitted,
            None => 0,
        };

        oracles.set(
            oracle.clone(),
            ArbitrationOracle {
                address: oracle.clone(),
                public_key: public_key.clone(),
                is_active,
                registered_at,
                resolutions_submitted,
            },
        );
        env.storage().instance().set(&ORACLES, &oracles);

        emit_dispute_oracle_updated(
            env,
            DisputeOracleUpdatedEvent {
                oracle: oracle.clone(),
                public_key: public_key.clone(),
                is_active,
                updated_by: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    /// Get a registered arbitration oracle
    pub fn get_oracle(env: &Env, oracle: &Address) -> Option<ArbitrationOracle> {
        let oracles: Map<Address, ArbitrationOracle> = env
            .storage()
            .instance()
            .get(&ORACLES)
            .unwrap_or(Map::new(env));
        oracles.get(oracle.clone())
    }

    /// The exact byte string an oracle must sign to resolve a dispute.
    ///
    /// Built from the on-chain dispute state (dispute id, transaction id, and the
    /// resolution being asserted) rather than supplied by the caller, so a
    /// signature collected for one dispute can never be replayed against another.
    pub fn oracle_attestation_payload(
        env: &Env,
        dispute_id: u64,
        transaction_id: u64,
        resolution: u64,
    ) -> Bytes {
        let mut payload = Bytes::new(env);
        payload.append(&Bytes::from_slice(env, &dispute_id.to_be_bytes()));
        payload.append(&Bytes::from_slice(env, &transaction_id.to_be_bytes()));
        payload.append(&Bytes::from_slice(env, &resolution.to_be_bytes()));
        payload
    }

    /// Submit a bindings resolution from a registered arbitration oracle.
    ///
    /// Validation, in order:
    /// 1. `oracle` must authenticate (`require_auth`), so a multi-sig or DAO
    ///    oracle gets its own approval policy enforced by the host.
    /// 2. `oracle` must be a registered, active oracle.
    /// 3. `resolution` must be one of the four known outcomes.
    /// 4. The dispute must still be open and unpaid.
    /// 5. `signature` must be a valid ed25519 signature by the oracle's
    ///    registered public key over [`Self::oracle_attestation_payload`].
    ///
    /// The decision is then recorded and the escrow paid out under it, because
    /// oracle resolutions are binding.
    pub fn submit_oracle_resolution(
        env: &Env,
        dispute_id: u64,
        resolution: u64,
        oracle: &Address,
        signature: &BytesN<64>,
    ) -> Result<(), SettlementError> {
        oracle.require_auth();
        Self::validate_resolution(resolution)?;

        let mut record = Self::get_oracle(env, oracle).ok_or(DisputeError::OracleNotRegistered)?;
        if !record.is_active {
            return Err(DisputeError::OracleInactive.into());
        }

        let mut dispute = DisputeStore::get(env, dispute_id)?;
        if dispute.resolved_at != 0 {
            return Err(SettlementError::DisputeAlreadyResolved);
        }
        if dispute.settled_at != 0 {
            return Err(DisputeError::AlreadySettled.into());
        }

        let payload =
            Self::oracle_attestation_payload(env, dispute_id, dispute.transaction_id, resolution);
        // Panics (and so reverts the whole call) if the signature is not valid for
        // this payload and key — the same failure mode `require_auth` uses.
        env.crypto()
            .ed25519_verify(&record.public_key, &payload, signature);

        dispute.resolution = resolution;
        dispute.resolved_at = env.ledger().timestamp();
        DisputeStore::update(env, &dispute)?;

        record.resolutions_submitted += 1;
        let mut oracles: Map<Address, ArbitrationOracle> = env
            .storage()
            .instance()
            .get(&ORACLES)
            .unwrap_or(Map::new(env));
        oracles.set(oracle.clone(), record);
        env.storage().instance().set(&ORACLES, &oracles);

        emit_dispute_resolved(
            env,
            DisputeResolvedEvent {
                dispute_id,
                resolution,
                winning_votes: 0,
                total_votes: 0,
                timestamp: dispute.resolved_at,
            },
        );
        emit_dispute_oracle_submitted(
            env,
            DisputeOracleSubmittedEvent {
                dispute_id,
                transaction_id: dispute.transaction_id,
                oracle: oracle.clone(),
                resolution,
                timestamp: dispute.resolved_at,
            },
        );

        Self::settle_dispute_escrow(env, &mut dispute)
    }

    /// Internal: Try to resolve dispute if enough votes
    fn try_resolve_dispute(env: &Env, dispute: &mut Dispute) -> Result<(), SettlementError> {
        if dispute.settled_at != 0 || dispute.resolved_at != 0 {
            return Ok(());
        }

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

    // ── Arbitrator selection ─────────────────────────────────────────────────

    /// Internal: Select arbitrators for a dispute.
    ///
    /// The previous implementation took the first N eligible arbitrators in
    /// registry order, which made assignment predictable: an attacker who could
    /// pick a transaction id (or simply wait for the right block) knew exactly
    /// which arbitrators would judge the dispute, and so knew who to bribe.
    ///
    /// Selection is now reputation-weighted and shuffled:
    ///
    /// * Each eligible arbitrator contributes `1 + min(reputation / 1000, 4)`
    ///   entries to a pool, so better-regarded arbitrators are more likely to be
    ///   drawn but a single very high-reputation arbitrator cannot dominate.
    /// * The pool is shuffled by a Fisher-Yates pass driven by
    ///   [`Self::selection_seed`], which mixes the ledger timestamp, the ledger
    ///   sequence, the disputed transaction id, and an admin-rotatable seed.
    ///   Soroban has no RNG, so this is deterministic given the ledger — which is
    ///   what makes it testable — but it is not derivable by a party who cannot
    ///   see the ledger the dispute lands in.
    /// * Distinct arbitrators are then taken in shuffled order until
    ///   `max_arbitrators_per_dispute` is reached.
    ///
    /// The pool is capped at [`MAX_SELECTION_POOL`] entries to bound cost as the
    /// registry grows; past that point later entries get no weight.
    fn select_arbitrators(
        env: &Env,
        config: &DisputeConfig,
        transaction_id: u64,
    ) -> Result<Vec<Address>, SettlementError> {
        let all_arbitrators = Self::get_all_arbitrators(env)?;

        let mut pool: Vec<Address> = Vec::new(env);
        for arb in all_arbitrators.iter() {
            if arb.is_active != 1 || arb.reputation_score < config.min_arbitrator_reputation {
                continue;
            }
            let copies =
                1 + (arb.reputation_score / REPUTATION_WEIGHT_UNIT).min(REPUTATION_WEIGHT_CAP);
            for _ in 0..copies {
                if pool.len() >= MAX_SELECTION_POOL {
                    break;
                }
                pool.push_back(arb.address.clone());
            }
        }

        if pool.is_empty() {
            return Ok(Vec::new(env));
        }

        // Fisher-Yates over the weighted pool.
        let mut state = Self::selection_seed(env, transaction_id) | 1;
        let len = pool.len();
        for i in (1..len).rev() {
            let j = (next_pseudo_random(&mut state) % (i as u64 + 1)) as u32;
            let a = pool.get(i).unwrap();
            let b = pool.get(j).unwrap();
            pool.set(i, b);
            pool.set(j, a);
        }

        let mut selected: Vec<Address> = Vec::new(env);
        for address in pool.iter() {
            if selected.contains(address.clone()) {
                continue;
            }
            selected.push_back(address);
            if selected.len() as u64 >= config.max_arbitrators_per_dispute {
                break;
            }
        }

        Ok(selected)
    }

    /// Internal: deterministic pseudo-random seed for one dispute's selection.
    fn selection_seed(env: &Env, transaction_id: u64) -> u64 {
        let stored: u64 = env.storage().instance().get(&SELECTION_SEED).unwrap_or(0);
        stored
            ^ env.ledger().timestamp().wrapping_mul(0x9E37_79B9_7F4A_7C15)
            ^ (env.ledger().sequence() as u64).wrapping_mul(0xBF58_476D_1CE4_E5B9)
            ^ transaction_id.wrapping_mul(0x94D0_49BB_1331_11EB)
    }

    /// Rotate the arbitrator selection entropy (dispute admin only)
    ///
    /// Useful if the current seed is believed to have leaked to someone trying to
    /// predict future arbitrator assignments.
    pub fn reseed_arbitrator_selection(env: &Env, admin: &Address) -> Result<(), SettlementError> {
        Self::require_dispute_admin(env, admin)?;

        let previous: u64 = env.storage().instance().get(&SELECTION_SEED).unwrap_or(0);
        let next = next_pseudo_random(&mut {
            previous
                ^ env.ledger().timestamp()
                ^ (env.ledger().sequence() as u64).wrapping_mul(0x2545_F491_4F6C_DD1D)
        });
        env.storage().instance().set(&SELECTION_SEED, &next);
        Ok(())
    }

    /// Internal: Update arbitrator reputations after dispute resolution
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

            // Update reputation based on participation and success rate
            let success_rate = (arb.successful_resolutions * 100)
                .checked_div(arb.disputes_handled)
                .unwrap_or(100);

            arb.reputation_score = success_rate;
            Self::store_arbitrator(env, &arb)?;
        }

        Ok(())
    }

    // ── Settlement ───────────────────────────────────────────────────────────

    /// Internal: pay out the disputed escrow under the dispute's resolution.
    ///
    /// This is the single path all four outcomes funnel through. It looks at the
    /// transaction's real escrow holdings (via `AtomicSwapEngine` /
    /// `EscrowManager`), works out who is entitled to what, and hands the actual
    /// transfers to [`AtomicSwapEngine::settle_dispute_escrow`] — the escrow
    /// primitive that marks holdings released so nothing can be paid twice. It
    /// then emits one `DisputeFundsReleasedEvent` per real movement.
    fn settle_dispute_escrow(env: &Env, dispute: &mut Dispute) -> Result<(), SettlementError> {
        if dispute.settled_at != 0 {
            return Err(DisputeError::AlreadySettled.into());
        }
        if dispute.resolved_at == 0 || dispute.resolution == DISPUTE_RESOLUTION_NOT_RESOLVED {
            return Err(SettlementError::InvalidState);
        }

        let plan = Self::payout_plan(env, dispute)?;

        let releases = AtomicSwapEngine::settle_dispute_escrow(
            env,
            dispute.transaction_id,
            &plan.payment_primary,
            plan.payment_primary_bps,
            &plan.payment_secondary,
            &plan.nft_recipient,
        )?;

        if releases.is_empty() {
            // Nothing was escrowed (or everything was already released): refuse
            // rather than report a settlement that moved no assets.
            return Err(DisputeError::NoEscrowedFunds.into());
        }

        // Reflect the outcome on the transaction itself where one is recorded.
        Self::apply_transaction_outcome(env, dispute.transaction_id, dispute.resolution)?;

        dispute.settled_at = env.ledger().timestamp();
        DisputeStore::update(env, dispute)?;

        for release in releases.iter() {
            emit_dispute_funds_released(
                env,
                DisputeFundsReleasedEvent {
                    dispute_id: dispute.dispute_id,
                    transaction_id: release.transaction_id,
                    resolution: dispute.resolution,
                    from: release.from.clone(),
                    to: release.to.clone(),
                    asset: release.asset.clone(),
                    amount: release.amount,
                    is_nft: release.is_nft,
                    timestamp: release.timestamp,
                },
            );
        }

        Ok(())
    }

    /// Internal: who receives what, given the dispute's real escrow holdings.
    ///
    /// Recipients are derived from the escrow itself rather than from a separate
    /// record: the payment was deposited by whoever funded the transaction (the
    /// buyer, once `execute_sale_swap` has stamped the holding) and the NFT by the
    /// seller. That keeps settlement correct even for a transaction whose sale
    /// record is missing or stale.
    ///
    /// * `REFUND_BUYER` — payment back to the buyer, NFT back to the seller.
    /// * `RELEASE_TO_SELLER` — payment to the seller, NFT to the buyer.
    /// * `SPLIT_FUNDS` — `DisputeConfig::split_buyer_bps` of the payment to the
    ///   buyer and the rest to the seller, NFT back to the seller.
    /// * `CANCEL_TRANSACTION` — same movement as `REFUND_BUYER` (a full unwind),
    ///   plus the recorded sale is marked `Cancelled`.
    fn payout_plan(env: &Env, dispute: &Dispute) -> Result<PayoutPlan, SettlementError> {
        let holdings = EscrowManager::get_escrow_holdings(env, dispute.transaction_id);

        let mut buyer: Option<Address> = None;
        let mut seller: Option<Address> = None;
        for holding in holdings.iter() {
            if !holding.is_deposited || holding.released_at.is_some() {
                continue;
            }
            if holding.is_nft {
                if seller.is_none() {
                    seller = Some(holding.holder);
                }
            } else if buyer.is_none() {
                buyer = Some(holding.holder);
            }
        }

        let seller = seller
            .or_else(|| buyer.clone())
            .ok_or(DisputeError::NoEscrowedFunds)?;
        let buyer = buyer.unwrap_or_else(|| seller.clone());

        let config = Self::get_dispute_config(env)?;
        let plan = match dispute.resolution {
            DISPUTE_RESOLUTION_REFUND_BUYER => PayoutPlan {
                payment_primary: buyer,
                payment_primary_bps: BPS_DENOMINATOR,
                payment_secondary: seller.clone(),
                nft_recipient: seller,
            },
            DISPUTE_RESOLUTION_RELEASE_TO_SELLER => PayoutPlan {
                payment_primary: seller.clone(),
                payment_primary_bps: BPS_DENOMINATOR,
                payment_secondary: buyer.clone(),
                nft_recipient: buyer,
            },
            DISPUTE_RESOLUTION_SPLIT_FUNDS => PayoutPlan {
                payment_primary: buyer,
                payment_primary_bps: config.split_buyer_bps,
                payment_secondary: seller.clone(),
                nft_recipient: seller,
            },
            DISPUTE_RESOLUTION_CANCEL_TRANSACTION => PayoutPlan {
                payment_primary: buyer,
                payment_primary_bps: BPS_DENOMINATOR,
                payment_secondary: seller.clone(),
                nft_recipient: seller,
            },
            _ => return Err(DisputeError::InvalidResolution.into()),
        };

        Ok(plan)
    }

    /// Internal: reflect a resolution on the recorded transaction, when there is one.
    ///
    /// A dispute can cover a transaction this contract does not hold a sale record
    /// for (an auction or a trade, say), so a missing sale is not an error — the
    /// escrow payout is the part that must always happen.
    fn apply_transaction_outcome(
        env: &Env,
        transaction_id: u64,
        resolution: u64,
    ) -> Result<(), SettlementError> {
        let mut sale = match SaleTransactionStore::get(env, transaction_id) {
            Ok(sale) => sale,
            Err(SettlementError::TransactionNotFound) => return Ok(()),
            Err(err) => return Err(err),
        };

        // Never downgrade an already-executed sale.
        if sale.state != TransactionState::Executed {
            sale.state = if resolution == DISPUTE_RESOLUTION_CANCEL_TRANSACTION {
                TransactionState::Cancelled
            } else {
                TransactionState::Resolved
            };
            SaleTransactionStore::update(env, &sale)?;
        }

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

        Ok(arbitrators.get(address.clone()).unwrap_or(Arbitrator {
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

/// Advancing a 64-bit LCG (Knuth's MMIX constants).
///
/// Soroban has no source of randomness and no `std`, so arbitrator selection has
/// to derive its entropy from ledger state. An LCG is not cryptographic, but it
/// only has to stop the *assignment* from being predictable before the dispute is
/// created and to spread selections across the registry; the ledger timestamp and
/// sequence it is seeded from are not knowable in advance to a useful degree.
fn next_pseudo_random(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    *state
}

/// Default dispute configuration
impl Default for DisputeConfig {
    fn default() -> Self {
        Self {
            arbitration_quorum: 3,
            cooling_period: 86400,              // 24 hours
            evidence_submission_period: 604800, // 7 days
            max_arbitrators_per_dispute: 5,
            min_arbitrator_reputation: 50,
            dispute_timeout: 604800, // 7 days without quorum -> default outcome
            split_buyer_bps: 5000,   // 50/50 split
            default_resolution: DISPUTE_RESOLUTION_REFUND_BUYER,
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
        _submitter: &Address,
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
        if evidence.len() > 10000 {
            // 10KB limit
            return Err(SettlementError::InvalidAmount);
        }
        Ok(())
    }
}
