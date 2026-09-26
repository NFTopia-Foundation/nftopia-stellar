use crate::error::{SettlementError, WithdrawalAnomalyError};
use crate::events::{
    emit_front_running_detected, emit_withdrawal_anomaly, FrontRunningDetectedEvent,
    WithdrawalAnomalyEvent,
};
use crate::types::Bid;
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Symbol, Vec};

// Storage keys
const COMMITMENT_STORAGE: Symbol = symbol_short!("commits");

/// Commit-reveal scheme for bid protection
pub struct CommitRevealScheme;

impl CommitRevealScheme {
    /// Create a commitment hash from bid details
    pub fn create_commitment(
        _bidder: &Address,
        _auction_id: u64,
        _bid_amount: i128,
        salt: &Bytes,
    ) -> Bytes {
        salt.clone()
    }

    /// Store a commitment
    pub fn store_commitment(
        env: &Env,
        bidder: &Address,
        auction_id: u64,
        commitment_hash: &Bytes,
        reveal_deadline: u64,
    ) -> Result<(), SettlementError> {
        let mut commitments: soroban_sdk::Map<Address, soroban_sdk::Map<u64, (Bytes, u64)>> = env
            .storage()
            .instance()
            .get(&COMMITMENT_STORAGE)
            .unwrap_or(soroban_sdk::Map::new(env));

        let mut bidder_commitments = commitments
            .get(bidder.clone())
            .unwrap_or(soroban_sdk::Map::new(env));

        bidder_commitments.set(auction_id, (commitment_hash.clone(), reveal_deadline));
        commitments.set(bidder.clone(), bidder_commitments);

        env.storage()
            .instance()
            .set(&COMMITMENT_STORAGE, &commitments);
        Ok(())
    }

    /// Reveal and verify a commitment
    pub fn reveal_commitment(
        env: &Env,
        bidder: &Address,
        auction_id: u64,
        bid_amount: i128,
        salt: &Bytes,
    ) -> Result<(), SettlementError> {
        let commitments: soroban_sdk::Map<Address, soroban_sdk::Map<u64, (Bytes, u64)>> = env
            .storage()
            .instance()
            .get(&COMMITMENT_STORAGE)
            .ok_or(SettlementError::NotFound)?;

        let bidder_commitments = commitments
            .get(bidder.clone())
            .ok_or(SettlementError::NotFound)?;

        let (stored_hash, reveal_deadline) = bidder_commitments
            .get(auction_id)
            .unwrap_or((Bytes::new(env), 0));

        // Check if reveal deadline has passed
        let current_time = env.ledger().timestamp();
        if current_time > reveal_deadline {
            return Err(SettlementError::Expired);
        }

        // Verify the commitment
        let computed_hash = Self::create_commitment(bidder, auction_id, bid_amount, salt);
        if computed_hash != stored_hash {
            return Err(SettlementError::CommitmentMismatch);
        }

        Ok(())
    }

    /// Clean up expired commitments
    pub fn cleanup_expired_commitments(env: &Env) -> Result<(), SettlementError> {
        let current_time = env.ledger().timestamp();
        let mut commitments: soroban_sdk::Map<Address, soroban_sdk::Map<u64, (Bytes, u64)>> = env
            .storage()
            .instance()
            .get(&COMMITMENT_STORAGE)
            .unwrap_or(soroban_sdk::Map::new(env));

        // This is a simplified cleanup - in production you'd want a more efficient approach
        let bidders: Vec<Address> = commitments.keys();

        for bidder in bidders.iter() {
            if let Some(mut bidder_commitments) = commitments.get(bidder.clone()) {
                let auction_ids: Vec<u64> = bidder_commitments.keys();

                for auction_id in auction_ids.iter() {
                    if let Some((_, reveal_deadline)) = bidder_commitments.get(auction_id) {
                        if current_time > reveal_deadline {
                            bidder_commitments.remove(auction_id);
                        }
                    }
                }

                if bidder_commitments.is_empty() {
                    commitments.remove(bidder.clone());
                } else {
                    commitments.set(bidder.clone(), bidder_commitments);
                }
            }
        }

        env.storage()
            .instance()
            .set(&COMMITMENT_STORAGE, &commitments);
        Ok(())
    }
}

/// Front-running pattern detection
pub struct FrontRunningDetector;

impl FrontRunningDetector {
    /// Analyze bidding patterns for potential front-running
    pub fn analyze_bidding_pattern(
        env: &Env,
        auction_id: u64,
        new_bid: &Bid,
        recent_bids: &Vec<Bid>,
    ) -> Result<(), SettlementError> {
        // Check for suspicious patterns
        let suspicious_patterns =
            Self::detect_suspicious_patterns(env, auction_id, new_bid, recent_bids)?;

        if !suspicious_patterns.is_empty() {
            // Emit front-running detection event
            let event = FrontRunningDetectedEvent {
                suspicious_address: new_bid.bidder.clone(),
                pattern: Bytes::from_slice(env, b"multiple_patterns"),
                timestamp: env.ledger().timestamp(),
            };
            emit_front_running_detected(env, event);

            return Err(SettlementError::FrontRunningDetected);
        }

        Ok(())
    }

    /// Detect various suspicious bidding patterns
    fn detect_suspicious_patterns(
        env: &Env,
        _auction_id: u64,
        new_bid: &Bid,
        recent_bids: &Vec<Bid>,
    ) -> Result<Vec<Bytes>, SettlementError> {
        let mut patterns = Vec::new(env);

        // Pattern 1: Rapid successive bids from same address
        if Self::detect_rapid_bidding(new_bid, recent_bids) {
            patterns.push_back(Bytes::from_slice(env, "rapid_bidding".as_bytes()));
        }

        // Pattern 2: Bid amounts that exactly match previous bids + increment
        if Self::detect_increment_gaming(new_bid, recent_bids) {
            patterns.push_back(Bytes::from_slice(env, "increment_gaming".as_bytes()));
        }

        // Pattern 3: Bids placed at exact time intervals
        if Self::detect_timed_bidding(env, new_bid, recent_bids) {
            patterns.push_back(Bytes::from_slice(env, "timed_bidding".as_bytes()));
        }

        Ok(patterns)
    }

    /// Detect rapid successive bidding from same address
    fn detect_rapid_bidding(new_bid: &Bid, recent_bids: &Vec<Bid>) -> bool {
        let mut same_bidder_count = 0u32;
        let time_window = 60; // 60 seconds

        for bid in recent_bids.iter() {
            if bid.bidder == new_bid.bidder && new_bid.placed_at - bid.placed_at < time_window {
                same_bidder_count += 1;
                if same_bidder_count >= 3 {
                    return true;
                }
            }
        }
        false
    }

    /// Detect bids that game the increment system
    fn detect_increment_gaming(new_bid: &Bid, recent_bids: &Vec<Bid>) -> bool {
        if recent_bids.is_empty() {
            return false;
        }

        // Check if new bid exactly matches expected increment
        // This is a simplified check - in practice you'd have more sophisticated logic
        for bid in recent_bids.iter().rev().take(3) {
            let expected_increment = bid.amount + 1000; // Example increment
            if new_bid.amount == expected_increment {
                return true;
            }
        }
        false
    }

    /// Detect suspiciously timed bidding
    fn detect_timed_bidding(env: &Env, new_bid: &Bid, recent_bids: &Vec<Bid>) -> bool {
        if recent_bids.len() < 2 {
            return false;
        }

        // Check for regular time intervals between bids
        let mut intervals = Vec::new(env);

        for i in 1..recent_bids.len() {
            if let (Some(prev_bid), Some(curr_bid)) = (recent_bids.get(i - 1), recent_bids.get(i)) {
                intervals.push_back(curr_bid.placed_at - prev_bid.placed_at);
            }
        }

        // Check if new bid follows similar pattern
        if let Some(last_interval) = intervals.get(intervals.len() - 1) {
            let new_interval =
                new_bid.placed_at - recent_bids.get(recent_bids.len() - 1).unwrap().placed_at;
            let diff = new_interval.abs_diff(last_interval);

            // If timing is too regular (within 5 seconds), flag as suspicious
            diff < 5
        } else {
            false
        }
    }
}

// ---------------------------------------------------------------------------
// Withdrawal anomaly monitoring
// ---------------------------------------------------------------------------
//
// `WithdrawalPatternMonitor` used to be a placeholder that recorded nothing and
// evaluated nothing, so no anomaly detection was happening at all. It now keeps
// a rolling per-account history and evaluates each withdrawal attempt against
// the thresholds in `WithdrawalAnomalyConfig`.
//
// Criteria and the response model are documented for auditors in README.md
// ("Withdrawal anomaly monitoring").
// ---------------------------------------------------------------------------

/// Storage keys for withdrawal-monitoring state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WithdrawalStorageKey {
    /// `WithdrawalHistory` of one account (persistent storage).
    History(Address),
    /// `WithdrawalHold` of one account (persistent storage).
    Hold(Address),
    /// `WithdrawalAnomalyConfig` (instance storage).
    Config,
}

/// Thresholds used to classify a withdrawal as anomalous.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalAnomalyConfig {
    /// Rolling window (seconds) that withdrawal frequency is measured over.
    pub window_seconds: u64,
    /// Maximum withdrawals inside `window_seconds` before the account is held.
    pub max_withdrawals_per_window: u32,
    /// Minimum seconds that must pass between two consecutive withdrawals;
    /// anything faster is treated as a rapid-drain sequence.
    pub min_withdrawal_gap_seconds: u64,
    /// A withdrawal more than this many times the account's historical average
    /// is flagged (but still allowed).
    pub spike_multiplier: u32,
    /// Absolute floor: smaller amounts are never a spike, so dust withdrawals
    /// cannot trip the ratio check.
    pub min_spike_amount: i128,
    /// Withdrawals an account must have made before spike analysis applies.
    pub min_history_for_spike: u32,
    /// How many most-recent withdrawals are retained per account.
    ///
    /// Must be at least `max_withdrawals_per_window`, otherwise trimming would
    /// erase the entries the velocity check counts and silently weaken it.
    pub history_limit: u32,
}

impl Default for WithdrawalAnomalyConfig {
    fn default() -> Self {
        Self {
            window_seconds: 3_600,
            max_withdrawals_per_window: 5,
            min_withdrawal_gap_seconds: 5,
            spike_multiplier: 10,
            min_spike_amount: 1_000,
            min_history_for_spike: 3,
            history_limit: 20,
        }
    }
}

/// Why a withdrawal pattern was considered anomalous.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WithdrawalAnomalyKind {
    /// More withdrawals than `max_withdrawals_per_window` inside the window.
    Velocity,
    /// Two withdrawals closer together than `min_withdrawal_gap_seconds`.
    RapidSequence,
    /// A single withdrawal far above the account's historical average.
    AmountSpike,
}

/// Outcome of a withdrawal-pattern check.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WithdrawalAnomalyDecision {
    /// Pattern looks normal; the withdrawal may proceed.
    Allowed,
    /// Suspicious but permitted: recorded and emitted so it can be watched.
    Flagged(WithdrawalAnomalyKind),
    /// Blocked: the account is on a hold until an operator clears it.
    Held(WithdrawalAnomalyKind),
}

/// Rolling withdrawal history of a single account.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalHistory {
    /// Timestamps of the retained withdrawals, oldest first.
    pub timestamps: Vec<u64>,
    /// Amounts matched by index to `timestamps`.
    pub amounts: Vec<i128>,
    /// Total withdrawals ever recorded for this account.
    pub total_withdrawals: u64,
    /// Sum of every recorded amount, used for the running average.
    pub total_amount: i128,
    /// Timestamp of the most recent withdrawal (0 when none).
    pub last_withdrawal_at: u64,
}

/// An outstanding withdrawal hold raised by an anomaly.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalHold {
    /// Anomaly that raised the hold.
    pub reason: WithdrawalAnomalyKind,
    /// Amount of the withdrawal that tripped the check.
    pub amount: i128,
    /// Withdrawal channel, e.g. `withdraw_losing_bid`.
    pub withdrawal_type: Bytes,
    /// Ledger timestamp the hold was raised at.
    pub raised_at: u64,
}

/// Withdrawal-pattern monitor.
///
/// Stateless struct: all state lives in contract storage under
/// `WithdrawalStorageKey`, so any entrypoint can call it.
pub struct WithdrawalPatternMonitor;

impl WithdrawalPatternMonitor {
    /// Active thresholds, falling back to `WithdrawalAnomalyConfig::default()`
    /// when an admin has not configured any.
    pub fn get_config(env: &Env) -> WithdrawalAnomalyConfig {
        let key = WithdrawalStorageKey::Config;
        let stored: Option<WithdrawalAnomalyConfig> = env.storage().instance().get(&key);
        stored.unwrap_or_default()
    }

    /// Replace the thresholds.
    ///
    /// Rejects configurations that would disable detection (zero window, zero
    /// limits, negative spike floor): "monitoring enabled but inert" is exactly
    /// the failure this module was written to fix.
    pub fn set_config(
        env: &Env,
        config: WithdrawalAnomalyConfig,
    ) -> Result<(), WithdrawalAnomalyError> {
        if config.window_seconds == 0
            || config.max_withdrawals_per_window == 0
            || config.min_withdrawal_gap_seconds == 0
            || config.spike_multiplier == 0
            || config.min_spike_amount < 0
            || config.min_history_for_spike == 0
            || config.history_limit == 0
            || config.history_limit < config.max_withdrawals_per_window
        {
            return Err(WithdrawalAnomalyError::InvalidConfig);
        }

        env.storage()
            .instance()
            .set(&WithdrawalStorageKey::Config, &config);
        Ok(())
    }

    /// Rolling history retained for `user`.
    pub fn get_history(env: &Env, user: &Address) -> WithdrawalHistory {
        let key = WithdrawalStorageKey::History(user.clone());
        let stored: Option<WithdrawalHistory> = env.storage().persistent().get(&key);
        stored.unwrap_or_else(|| WithdrawalHistory {
            timestamps: Vec::new(env),
            amounts: Vec::new(env),
            total_withdrawals: 0,
            total_amount: 0,
            last_withdrawal_at: 0,
        })
    }

    /// Outstanding hold for `user`, if any.
    pub fn get_hold(env: &Env, user: &Address) -> Option<WithdrawalHold> {
        let key = WithdrawalStorageKey::Hold(user.clone());
        env.storage().persistent().get(&key)
    }

    /// Whether `user` is currently blocked from withdrawing.
    pub fn is_held(env: &Env, user: &Address) -> bool {
        env.storage()
            .persistent()
            .has(&WithdrawalStorageKey::Hold(user.clone()))
    }

    /// Clear a hold after review, letting `user` withdraw again.
    ///
    /// This is the "additional confirmation" step of the response model. It
    /// requires a hold to exist, and callers must gate it behind an
    /// operator/admin authorization check: a held account must not be able to
    /// lift its own hold. The rolling history is deliberately *not* cleared, so
    /// the anomaly stays visible to auditors after the hold is lifted.
    pub fn clear_hold(env: &Env, user: &Address) -> Result<(), WithdrawalAnomalyError> {
        let key = WithdrawalStorageKey::Hold(user.clone());
        if !env.storage().persistent().has(&key) {
            return Err(WithdrawalAnomalyError::NoHold);
        }
        env.storage().persistent().remove(&key);
        Ok(())
    }

    /// Record a withdrawal attempt and evaluate it against the criteria.
    ///
    /// Returns [`WithdrawalAnomalyDecision::Allowed`] for a normal pattern,
    /// [`WithdrawalAnomalyDecision::Flagged`] when the amount is a spike (the
    /// withdrawal may proceed but is surfaced for monitoring), or
    /// [`WithdrawalAnomalyDecision::Held`] when the account is put on - or stays
    /// on - a hold and must not withdraw until `clear_hold` is called.
    ///
    /// Every evaluated attempt is appended to the account's rolling history,
    /// including flagged ones. An attempt refused because the account is
    /// *already* held is reported but not recorded: it never happened.
    pub fn monitor_withdrawal(
        env: &Env,
        user: &Address,
        amount: i128,
        withdrawal_type: &str,
    ) -> Result<WithdrawalAnomalyDecision, WithdrawalAnomalyError> {
        // An account already on a hold stays on it until an operator clears it,
        // so a repeat attempt cannot argue its way out of the hold.
        if let Some(hold) = Self::get_hold(env, user) {
            Self::report(env, user, amount, withdrawal_type, hold.reason, true);
            return Ok(WithdrawalAnomalyDecision::Held(hold.reason));
        }

        let config = Self::get_config(env);
        let mut history = Self::get_history(env, user);
        let now = env.ledger().timestamp();
        let decision = Self::evaluate(&history, amount, now, &config);

        // Always record: the analysis depends on this history, and an auditor
        // needs to see the attempt even when it was allowed.
        Self::record(&mut history, amount, now, &config);
        Self::store_history(env, user, &history);

        match decision {
            WithdrawalAnomalyDecision::Held(kind) => {
                let hold = WithdrawalHold {
                    reason: kind,
                    amount,
                    withdrawal_type: Bytes::from_slice(env, withdrawal_type.as_bytes()),
                    raised_at: now,
                };
                let key = WithdrawalStorageKey::Hold(user.clone());
                env.storage().persistent().set(&key, &hold);
                env.storage().persistent().extend_ttl(&key, 1_000, 5_000);
                Self::report(env, user, amount, withdrawal_type, kind, true);
            }
            WithdrawalAnomalyDecision::Flagged(kind) => {
                Self::report(env, user, amount, withdrawal_type, kind, false);
            }
            WithdrawalAnomalyDecision::Allowed => {}
        }

        Ok(decision)
    }

    /// Evaluate a hypothetical withdrawal without recording it.
    ///
    /// Answers "would this be allowed?" for pre-flight checks; it never mutates
    /// history, but it does respect an existing hold.
    pub fn check_unusual_pattern(
        env: &Env,
        user: &Address,
        amount: i128,
    ) -> Result<WithdrawalAnomalyDecision, WithdrawalAnomalyError> {
        if let Some(hold) = Self::get_hold(env, user) {
            return Ok(WithdrawalAnomalyDecision::Held(hold.reason));
        }

        let config = Self::get_config(env);
        let history = Self::get_history(env, user);
        Ok(Self::evaluate(
            &history,
            amount,
            env.ledger().timestamp(),
            &config,
        ))
    }

    /// The anomaly criteria, checked in escalating order of severity.
    ///
    /// 1. **Velocity** - more than `max_withdrawals_per_window` withdrawals in
    ///    the trailing `window_seconds` => hold.
    /// 2. **Rapid sequence** - less than `min_withdrawal_gap_seconds` since
    ///    the previous withdrawal => hold.
    /// 3. **Amount spike** - at least `min_history_for_spike` prior withdrawals,
    ///    and this amount is more than `spike_multiplier` times the account's
    ///    historical average, and at or above `min_spike_amount` => flag.
    fn evaluate(
        history: &WithdrawalHistory,
        amount: i128,
        now: u64,
        config: &WithdrawalAnomalyConfig,
    ) -> WithdrawalAnomalyDecision {
        let window_start = now.saturating_sub(config.window_seconds);
        let mut in_window: u32 = 0;
        for timestamp in history.timestamps.iter() {
            if timestamp >= window_start {
                in_window += 1;
            }
        }
        if in_window >= config.max_withdrawals_per_window {
            return WithdrawalAnomalyDecision::Held(WithdrawalAnomalyKind::Velocity);
        }

        if history.last_withdrawal_at > 0
            && now.saturating_sub(history.last_withdrawal_at) < config.min_withdrawal_gap_seconds
        {
            return WithdrawalAnomalyDecision::Held(WithdrawalAnomalyKind::RapidSequence);
        }

        if amount > 0
            && history.total_withdrawals > 0
            && history.total_withdrawals >= config.min_history_for_spike as u64
        {
            let average = history.total_amount / (history.total_withdrawals as i128);
            let threshold = average.saturating_mul(config.spike_multiplier as i128);
            if amount > threshold && amount >= config.min_spike_amount {
                return WithdrawalAnomalyDecision::Flagged(WithdrawalAnomalyKind::AmountSpike);
            }
        }

        WithdrawalAnomalyDecision::Allowed
    }

    /// Append the attempt to the rolling history, trimming to `history_limit`.
    fn record(
        history: &mut WithdrawalHistory,
        amount: i128,
        now: u64,
        config: &WithdrawalAnomalyConfig,
    ) {
        history.timestamps.push_back(now);
        history.amounts.push_back(amount);
        history.total_withdrawals += 1;
        history.total_amount = history.total_amount.saturating_add(amount);
        history.last_withdrawal_at = now;

        while history.timestamps.len() > config.history_limit {
            history.timestamps.remove(0);
            history.amounts.remove(0);
        }
    }

    fn store_history(env: &Env, user: &Address, history: &WithdrawalHistory) {
        let key = WithdrawalStorageKey::History(user.clone());
        env.storage().persistent().set(&key, history);
        env.storage().persistent().extend_ttl(&key, 1_000, 5_000);
    }

    fn report(
        env: &Env,
        user: &Address,
        amount: i128,
        withdrawal_type: &str,
        reason: WithdrawalAnomalyKind,
        blocked: bool,
    ) {
        let event = WithdrawalAnomalyEvent {
            user: user.clone(),
            amount,
            withdrawal_type: Bytes::from_slice(env, withdrawal_type.as_bytes()),
            reason,
            blocked,
            timestamp: env.ledger().timestamp(),
        };
        emit_withdrawal_anomaly(env, event);
    }
}
