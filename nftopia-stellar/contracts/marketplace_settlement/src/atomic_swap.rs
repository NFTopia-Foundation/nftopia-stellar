use crate::error::{SettlementError, SwapTimeoutError};
use crate::events::{SwapAutoRefundedEvent, SwapExpiredEvent, SwapTimeoutConfigUpdatedEvent};
use crate::security::reentrancy_guard::ReentrancyGuard;
use crate::types::{Asset, ExecutionResult, SwapTimeoutConfig, TokenAsset};
use crate::utils::asset_utils;
use crate::utils::time_utils;
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Map, Symbol, Vec};

// Storage keys
const ATOMIC_SWAPS: Symbol = symbol_short!("atom_swps");
const SWAP_TIMEOUT_CFG: Symbol = symbol_short!("swap_cfg");

/// Swaps inspected per `cleanup_expired_swaps` call when no limit is supplied.
/// Bounded so a single cleanup invocation cannot exceed the resource budget.
const DEFAULT_CLEANUP_LIMIT: u32 = 20;

/// Represents an escrow holding
///
/// `escrow_expires_at` is the hard backstop for the funds in this holding: once the
/// ledger timestamp passes it, the holding is reclaimable by anyone via
/// [`AtomicSwapEngine::reclaim_expired_escrow`], regardless of what state the swap
/// itself is in. That is what keeps escrowed value from being locked forever when a
/// swap is neither completed nor cancelled.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowHolding {
    pub transaction_id: u64,
    pub holder: Address, // Who deposited the funds/NFTs
    pub asset: Asset,
    pub amount: i128, // For tokens, or token_id for NFTs
    pub is_nft: bool,
    /// Whether the holder has actually transferred the asset into escrow.
    ///
    /// Refunds are gated on this flag. Without it, the permissionless expiry paths
    /// would pay out holdings that were only ever reserved, draining the contract.
    pub is_deposited: bool,
    pub deposited_at: u64, // 0 until deposited
    pub escrow_expires_at: u64,
    pub released_at: Option<u64>,
}

/// Atomic swap state
///
/// Time-based expiry uses two independent clocks. `expires_at` is a ledger
/// timestamp; `expires_at_ledger` is the ledger sequence the same deadline is
/// projected to fall on. Rejecting new operations only needs the timestamp (a
/// rejection is reversible — the funds stay refundable), but confirming an expiry so
/// funds can be force-refunded requires both, so timestamp drift alone can never
/// trigger an irreversible refund.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AtomicSwap {
    pub swap_id: u64,
    pub transaction_id: u64,
    pub seller_escrow: Vec<EscrowHolding>,
    pub buyer_escrow: Vec<EscrowHolding>,
    pub state: SwapState,
    pub created_at: u64,
    pub created_ledger: u32,
    pub expires_at: u64,
    pub expires_at_ledger: u32,
    pub executed_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum SwapState {
    Pending = 0,
    SellerFunded = 1,
    BuyerFunded = 2,
    Ready = 3,
    Executed = 4,
    Failed = 5,
}

impl SwapState {
    /// Whether no further state transitions are possible.
    pub fn is_terminal(&self) -> bool {
        matches!(self, SwapState::Executed | SwapState::Failed)
    }
}

/// A single escrowed asset movement performed while settling a dispute.
///
/// Returned by [`AtomicSwapEngine::settle_dispute_escrow`] so the dispute layer
/// can emit one off-chain event per real transfer, and so callers can tell what
/// actually moved rather than inferring it from escrow state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowRelease {
    pub swap_id: u64,
    pub transaction_id: u64,
    /// Original depositor of the holding.
    pub from: Address,
    /// Who the holding was paid out to.
    pub to: Address,
    pub asset: Asset,
    pub amount: i128, // For NFTs this is the token id
    pub is_nft: bool,
    pub timestamp: u64,
}

/// Atomic swap engine for secure NFT and token transfers
pub struct AtomicSwapEngine;

impl AtomicSwapEngine {
    // ── Timeout configuration ────────────────────────────────────────────────

    /// Current timeout configuration, falling back to conservative defaults.
    pub fn timeout_config(env: &Env) -> SwapTimeoutConfig {
        env.storage()
            .instance()
            .get(&SWAP_TIMEOUT_CFG)
            .unwrap_or_else(SwapTimeoutConfig::defaults)
    }

    /// Persist a timeout configuration after validating it.
    pub fn set_timeout_config(
        env: &Env,
        config: &SwapTimeoutConfig,
        updated_by: &Address,
    ) -> Result<(), SettlementError> {
        Self::validate_timeout_config(config)?;
        env.storage().instance().set(&SWAP_TIMEOUT_CFG, config);

        crate::events::emit_swap_timeout_config_updated(
            env,
            SwapTimeoutConfigUpdatedEvent {
                new_config: config.clone(),
                updated_by: updated_by.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    /// Reject configurations that would disable expiry or overflow the time math.
    pub fn validate_timeout_config(config: &SwapTimeoutConfig) -> Result<(), SettlementError> {
        if config.max_swap_duration == 0 || config.default_swap_duration == 0 {
            return Err(SwapTimeoutError::InvalidTimeoutConfig.into());
        }
        if config.default_swap_duration > config.max_swap_duration {
            return Err(SwapTimeoutError::InvalidTimeoutConfig.into());
        }
        // A tolerance of zero would let a single ledger's timestamp confirm an
        // expiry, which is exactly the mainnet failure mode being guarded against.
        if config.ledger_tolerance_blocks == 0 {
            return Err(SwapTimeoutError::InvalidTimeoutConfig.into());
        }
        // Guard the deadline arithmetic: expiry + grace + escrow buffer must fit.
        let fits = config
            .max_swap_duration
            .checked_add(config.grace_period_seconds)
            .and_then(|v| v.checked_add(config.escrow_buffer_seconds))
            .is_some();
        if !fits {
            return Err(SwapTimeoutError::InvalidTimeoutConfig.into());
        }
        Ok(())
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /// Initialize an atomic swap for a transaction
    ///
    /// `swap_timeout_seconds` bounds the swap's lifetime; passing 0 applies the
    /// configured default. Values above `max_swap_duration` are rejected.
    #[allow(clippy::too_many_arguments)]
    pub fn initialize_swap(
        env: &Env,
        transaction_id: u64,
        seller: &Address,
        buyer: &Address,
        nft_address: &Address,
        token_id: u64,
        payment_asset: &Asset,
        payment_amount: i128,
        swap_timeout_seconds: u64,
    ) -> Result<u64, SettlementError> {
        let config = Self::timeout_config(env);

        let duration = if swap_timeout_seconds == 0 {
            config.default_swap_duration
        } else {
            swap_timeout_seconds
        };
        time_utils::validate_duration(duration, config.max_swap_duration)?;

        let created_at = env.ledger().timestamp();
        let created_ledger = time_utils::current_ledger(env);
        let expires_at = time_utils::calculate_expiration(created_at, duration)?;
        let expires_at_ledger = time_utils::projected_expiry_ledger(created_ledger, duration);

        // The escrow backstop sits past the swap's own effective deadline, so a swap
        // always gets the chance to settle or be cancelled before funds become
        // unconditionally reclaimable.
        let escrow_expires_at = time_utils::calculate_expiration(
            expires_at,
            config
                .grace_period_seconds
                .saturating_add(config.escrow_buffer_seconds),
        )?;

        let swap_id = Self::next_swap_id(env);

        let mut seller_escrow = Vec::new(env);
        seller_escrow.push_back(EscrowHolding {
            transaction_id,
            holder: seller.clone(),
            asset: Asset::Token(TokenAsset {
                contract: nft_address.clone(),
                symbol: Symbol::new(env, "NFT"),
            }),
            amount: token_id as i128,
            is_nft: true,
            is_deposited: false,
            deposited_at: 0,
            escrow_expires_at,
            released_at: None,
        });

        let mut buyer_escrow = Vec::new(env);
        buyer_escrow.push_back(EscrowHolding {
            transaction_id,
            holder: buyer.clone(),
            asset: payment_asset.clone(),
            amount: payment_amount,
            is_nft: false,
            is_deposited: false,
            deposited_at: 0,
            escrow_expires_at,
            released_at: None,
        });

        let atomic_swap = AtomicSwap {
            swap_id,
            transaction_id,
            seller_escrow,
            buyer_escrow,
            state: SwapState::Pending,
            created_at,
            created_ledger,
            expires_at,
            expires_at_ledger,
            executed_at: None,
        };

        Self::store_swap(env, &atomic_swap)?;
        Ok(swap_id)
    }

    /// Deposit funds/NFTs into escrow
    pub fn deposit_to_escrow(
        env: &Env,
        transaction_id: u64,
        depositor: &Address,
        asset: &Asset,
        amount: i128,
        is_nft: bool,
    ) -> Result<(), SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;
        let config = Self::timeout_config(env);

        // Refuse to take new funds into a swap that can no longer settle.
        Self::ensure_not_expired(env, &swap, &config)?;

        // Validate depositor
        let is_seller_deposit = swap
            .seller_escrow
            .iter()
            .any(|h| h.holder == *depositor && h.asset == *asset);
        let is_buyer_deposit = swap
            .buyer_escrow
            .iter()
            .any(|h| h.holder == *depositor && h.asset == *asset);

        if !is_seller_deposit && !is_buyer_deposit {
            return Err(SettlementError::Unauthorized);
        }

        // Perform the actual deposit (transfer to escrow)
        Self::transfer_to_escrow(env, depositor, asset, amount, is_nft)?;

        // Update escrow holdings
        Self::update_escrow_holding(env, &mut swap, depositor, asset, amount, is_nft)?;

        // Update swap state
        Self::update_swap_state(env, &mut swap)?;

        Self::store_swap(env, &swap)?;
        Ok(())
    }

    /// Execute the atomic swap
    pub fn execute_swap(
        env: &Env,
        transaction_id: u64,
        executor: &Address,
    ) -> Result<ExecutionResult, SettlementError> {
        ReentrancyGuard::execute(env, executor, "execute_swap", || {
            let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;
            let config = Self::timeout_config(env);

            // Deadline is checked before state so a stale swap always reports
            // SwapExpired rather than a misleading InvalidState.
            Self::ensure_not_expired(env, &swap, &config)?;

            // Validate swap is ready for execution
            if swap.state != SwapState::Ready {
                return Err(SettlementError::InvalidState);
            }

            // Perform the atomic swap
            Self::perform_atomic_swap(env, &mut swap)?;

            // Update swap state
            swap.state = SwapState::Executed;
            swap.executed_at = Some(env.ledger().timestamp());

            Self::store_swap(env, &swap)?;

            Ok(ExecutionResult {
                transaction_id,
                success: true,
                transferred_nft: true,
                transferred_payment: true,
                distributed_royalties: true, // This would be handled by royalty system
                collected_platform_fee: true, // This would be handled by fee system
                timestamp: env.ledger().timestamp(),
            })
        })
    }

    /// Fund a sale from the buyer and release the escrowed NFT.
    ///
    /// Payment remains in the settlement contract so royalties and platform
    /// fees can be distributed atomically by the caller.
    pub fn execute_sale_swap(
        env: &Env,
        transaction_id: u64,
        buyer: &Address,
    ) -> Result<(), SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;
        if swap.state != SwapState::SellerFunded {
            return Err(SettlementError::InvalidState);
        }

        let mut payment = swap
            .buyer_escrow
            .get(0)
            .ok_or(SettlementError::InvalidState)?;
        payment.holder = buyer.clone();
        Self::transfer_to_escrow(env, buyer, &payment.asset, payment.amount, false)?;

        let timestamp = env.ledger().timestamp().max(1);
        payment.deposited_at = timestamp;
        payment.released_at = Some(timestamp);
        swap.buyer_escrow.set(0, payment);
        swap.state = SwapState::Ready;

        for i in 0..swap.seller_escrow.len() {
            if let Some(mut holding) = swap.seller_escrow.get(i) {
                if holding.is_nft {
                    Self::transfer_from_escrow(env, buyer, &holding.asset, holding.amount, true)?;
                    holding.released_at = Some(timestamp);
                    swap.seller_escrow.set(i, holding);
                }
            }
        }

        swap.state = SwapState::Executed;
        swap.executed_at = Some(timestamp);
        Self::store_swap(env, &swap)
    }

    /// Cancel a swap and refund all parties
    ///
    /// Cancellation stays available after the deadline on purpose: blocking it would
    /// strand escrowed funds. An expired swap is instead routed through the expiry
    /// path so it emits the same timeout events as an automatic cleanup.
    pub fn cancel_swap(
        env: &Env,
        transaction_id: u64,
        canceller: &Address,
    ) -> Result<(), SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;
        let config = Self::timeout_config(env);

        if swap.state.is_terminal() {
            return Err(SwapTimeoutError::SwapAlreadyFinalized.into());
        }

        // Only seller or buyer can cancel
        let is_authorized = swap.seller_escrow.iter().any(|h| h.holder == *canceller)
            || swap.buyer_escrow.iter().any(|h| h.holder == *canceller);

        if !is_authorized {
            return Err(SettlementError::Unauthorized);
        }

        if Self::is_expired(env, &swap, &config)? {
            Self::finalize_expiry(env, &mut swap, &config)?;
        } else {
            Self::refund_escrow_holdings(env, &mut swap, false)?;
            swap.state = SwapState::Failed;
        }

        Self::store_swap(env, &swap)?;
        Ok(())
    }

    /// Mark a single expired swap as failed and refund its escrow.
    ///
    /// Permissionless: anyone may call it, since it can only ever return escrowed
    /// assets to the parties that deposited them.
    pub fn expire_swap(
        env: &Env,
        transaction_id: u64,
        _caller: &Address,
    ) -> Result<u32, SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;
        let config = Self::timeout_config(env);

        if swap.state.is_terminal() {
            return Err(SwapTimeoutError::SwapAlreadyFinalized.into());
        }

        if !Self::is_expiry_confirmed(env, &swap, &config)? {
            return Err(SwapTimeoutError::NotYetExpired.into());
        }

        let refunded = Self::finalize_expiry(env, &mut swap, &config)?;
        Self::store_swap(env, &swap)?;
        Ok(refunded)
    }

    /// Sweep expired swaps, marking them failed and refunding their escrow.
    ///
    /// Permissionless. `limit` caps how many swaps are expired in one call (0 applies
    /// [`DEFAULT_CLEANUP_LIMIT`]) so the sweep stays inside the resource budget as
    /// the swap map grows; callers repeat until it returns 0. Returns the number of
    /// swaps expired.
    pub fn cleanup_expired_swaps(
        env: &Env,
        _caller: &Address,
        limit: u32,
    ) -> Result<u32, SettlementError> {
        let config = Self::timeout_config(env);
        let max = if limit == 0 {
            DEFAULT_CLEANUP_LIMIT
        } else {
            limit
        };

        let mut swaps: Map<u64, AtomicSwap> = match env.storage().instance().get(&ATOMIC_SWAPS) {
            Some(swaps) => swaps,
            None => return Ok(0),
        };

        // Collect swap ids first, since finalizing mutates the map as we go. Ids come
        // from the map key rather than `transaction_id`, which is not unique across
        // swaps and could otherwise send the refund to the wrong swap.
        let mut expired_ids: Vec<u64> = Vec::new(env);
        for (swap_id, swap) in swaps.iter() {
            if expired_ids.len() >= max {
                break;
            }
            if swap.state.is_terminal() {
                continue;
            }
            if Self::is_expiry_confirmed(env, &swap, &config)? {
                expired_ids.push_back(swap_id);
            }
        }

        let mut expired_count = 0u32;
        for swap_id in expired_ids.iter() {
            if let Some(mut swap) = swaps.get(swap_id) {
                Self::finalize_expiry(env, &mut swap, &config)?;
                swaps.set(swap_id, swap);
                expired_count += 1;
            }
        }

        // One write for the whole sweep instead of one per swap.
        if expired_count > 0 {
            env.storage().instance().set(&ATOMIC_SWAPS, &swaps);
        }

        Ok(expired_count)
    }

    /// Reclaim escrow holdings whose own backstop deadline has passed.
    ///
    /// The last-resort guarantee that escrowed value is never locked indefinitely:
    /// it ignores swap state entirely and only asks whether each holding is past
    /// `escrow_expires_at` and still unreleased. Permissionless, and funds can only
    /// go back to the original depositor.
    pub fn reclaim_expired_escrow(
        env: &Env,
        transaction_id: u64,
        _caller: &Address,
    ) -> Result<u32, SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;

        let refunded = Self::refund_holdings(env, &mut swap, true, true)?;
        if refunded == 0 {
            return Err(SwapTimeoutError::NotYetExpired.into());
        }

        // An executed swap keeps its state; anything else is now dead.
        if swap.state != SwapState::Executed {
            swap.state = SwapState::Failed;
        }
        Self::store_swap(env, &swap)?;
        Ok(refunded)
    }

    /// Release the escrowed holdings of `transaction_id` to dispute-chosen
    /// recipients, marking each one released.
    ///
    /// This is the escrow-side mechanism behind dispute settlement, and the one
    /// place where a holding can be paid to somebody other than its original
    /// depositor. Every other payout path (`cancel_swap`, `expire_swap`,
    /// `cleanup_expired_swaps`, `reclaim_expired_escrow`, `emergency_withdraw`)
    /// only ever returns funds to the depositor.
    ///
    /// Every *deposited, unreleased* holding is paid out exactly once:
    ///
    /// * A payment holding (token/XLM) is split by `payment_primary_bps`:
    ///   that share goes to `payment_primary`, the remainder to
    ///   `payment_secondary`. A basis-point value of 10_000 pays it all to
    ///   `payment_primary`.
    /// * An NFT holding is transferred in full to `nft_recipient`.
    ///
    /// Each released holding gets `released_at` stamped, and the swap is moved to
    /// a terminal state, so replaying the same call cannot pay anyone twice. The
    /// returned vector describes exactly what moved; an empty vector means the
    /// escrow held nothing payable.
    ///
    /// Returns the underlying `SettlementError` from the asset transfer if a
    /// transfer fails (e.g. `PaymentFailed`, `NativeAssetTransferFailed`), rather
    /// than swallowing it.
    pub fn settle_dispute_escrow(
        env: &Env,
        transaction_id: u64,
        payment_primary: &Address,
        payment_primary_bps: u64,
        payment_secondary: &Address,
        nft_recipient: &Address,
    ) -> Result<Vec<EscrowRelease>, SettlementError> {
        if payment_primary_bps > 10_000 {
            return Err(SettlementError::InvalidAmount);
        }

        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;
        let now = env.ledger().timestamp();
        let mut releases = Vec::new(env);

        let mut seller_escrow = swap.seller_escrow.clone();
        Self::release_holdings_for_dispute(
            env,
            &swap,
            &mut seller_escrow,
            payment_primary,
            payment_primary_bps,
            payment_secondary,
            nft_recipient,
            now,
            &mut releases,
        )?;
        swap.seller_escrow = seller_escrow;

        let mut buyer_escrow = swap.buyer_escrow.clone();
        Self::release_holdings_for_dispute(
            env,
            &swap,
            &mut buyer_escrow,
            payment_primary,
            payment_primary_bps,
            payment_secondary,
            nft_recipient,
            now,
            &mut releases,
        )?;
        swap.buyer_escrow = buyer_escrow;

        // Terminal: no other escrow path may act on these holdings again.
        if swap.state != SwapState::Executed {
            swap.state = SwapState::Failed;
        }
        Self::store_swap(env, &swap)?;

        Ok(releases)
    }

    /// Internal: pay out one side's deposited, unreleased holdings.
    #[allow(clippy::too_many_arguments)]
    fn release_holdings_for_dispute(
        env: &Env,
        swap: &AtomicSwap,
        holdings: &mut Vec<EscrowHolding>,
        payment_primary: &Address,
        payment_primary_bps: u64,
        payment_secondary: &Address,
        nft_recipient: &Address,
        now: u64,
        releases: &mut Vec<EscrowRelease>,
    ) -> Result<(), SettlementError> {
        for i in 0..holdings.len() {
            let mut holding = match holdings.get(i) {
                Some(holding) => holding,
                None => continue,
            };
            if !holding.is_deposited || holding.released_at.is_some() {
                continue;
            }

            if holding.is_nft {
                Self::transfer_from_escrow(
                    env,
                    nft_recipient,
                    &holding.asset,
                    holding.amount,
                    true,
                )?;
                releases.push_back(EscrowRelease {
                    swap_id: swap.swap_id,
                    transaction_id: swap.transaction_id,
                    from: holding.holder.clone(),
                    to: nft_recipient.clone(),
                    asset: holding.asset.clone(),
                    amount: holding.amount,
                    is_nft: true,
                    timestamp: now,
                });
            } else {
                let primary_amount = holding
                    .amount
                    .checked_mul(payment_primary_bps as i128)
                    .ok_or(SettlementError::Overflow)?
                    / 10_000;
                let secondary_amount = holding.amount - primary_amount;

                if primary_amount > 0 {
                    Self::transfer_from_escrow(
                        env,
                        payment_primary,
                        &holding.asset,
                        primary_amount,
                        false,
                    )?;
                    releases.push_back(EscrowRelease {
                        swap_id: swap.swap_id,
                        transaction_id: swap.transaction_id,
                        from: holding.holder.clone(),
                        to: payment_primary.clone(),
                        asset: holding.asset.clone(),
                        amount: primary_amount,
                        is_nft: false,
                        timestamp: now,
                    });
                }
                if secondary_amount > 0 {
                    Self::transfer_from_escrow(
                        env,
                        payment_secondary,
                        &holding.asset,
                        secondary_amount,
                        false,
                    )?;
                    releases.push_back(EscrowRelease {
                        swap_id: swap.swap_id,
                        transaction_id: swap.transaction_id,
                        from: holding.holder.clone(),
                        to: payment_secondary.clone(),
                        asset: holding.asset.clone(),
                        amount: secondary_amount,
                        is_nft: false,
                        timestamp: now,
                    });
                }
            }

            holding.released_at = Some(now);
            holdings.set(i, holding);
        }

        Ok(())
    }

    /// Emergency withdrawal for stuck transactions
    pub fn emergency_withdraw(
        env: &Env,
        transaction_id: u64,
        admin: &Address,
        reason: &Bytes,
    ) -> Result<(), SettlementError> {
        // Admin permissions are checked by the contract entrypoint.
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;

        Self::refund_escrow_holdings(env, &mut swap, false)?;
        if swap.state != SwapState::Executed {
            swap.state = SwapState::Failed;
        }
        Self::store_swap(env, &swap)?;

        // Emit emergency withdrawal event
        let event = crate::events::EmergencyWithdrawalEvent {
            transaction_id,
            admin: admin.clone(),
            reason: reason.clone(),
            timestamp: env.ledger().timestamp(),
        };
        crate::events::emit_emergency_withdrawal(env, event);

        Ok(())
    }

    // ── Expiry checks ────────────────────────────────────────────────────────

    /// Whether the swap is past `expires_at` plus the configured grace period.
    ///
    /// Timestamp-only, and used to reject operations. Rejecting is reversible — the
    /// escrow stays refundable — so it does not need the stronger ledger check.
    pub fn is_expired(
        env: &Env,
        swap: &AtomicSwap,
        config: &SwapTimeoutConfig,
    ) -> Result<bool, SettlementError> {
        time_utils::is_expired_with_grace(swap.expires_at, config.grace_period_seconds, env)
    }

    /// Whether expiry is confirmed by both clocks.
    ///
    /// Requires the timestamp to be past the deadline *and* `ledger_tolerance_blocks`
    /// ledgers to have closed beyond the projected expiry ledger. Used before any
    /// irreversible timeout action, so neither a drifting timestamp nor an unusually
    /// slow stretch of ledger closes can force a refund on its own.
    pub fn is_expiry_confirmed(
        env: &Env,
        swap: &AtomicSwap,
        config: &SwapTimeoutConfig,
    ) -> Result<bool, SettlementError> {
        if !Self::is_expired(env, swap, config)? {
            return Ok(false);
        }
        Ok(time_utils::has_ledger_tolerance_passed(
            swap.expires_at_ledger,
            config.ledger_tolerance_blocks,
            env,
        ))
    }

    /// Reject an operation on a swap that is past its deadline or already finalized.
    fn ensure_not_expired(
        env: &Env,
        swap: &AtomicSwap,
        config: &SwapTimeoutConfig,
    ) -> Result<(), SettlementError> {
        if swap.state.is_terminal() {
            return Err(SwapTimeoutError::SwapAlreadyFinalized.into());
        }
        if Self::is_expired(env, swap, config)? {
            return Err(SwapTimeoutError::SwapExpired.into());
        }
        Ok(())
    }

    /// Seconds left before a swap's deadline (including grace); 0 once past it.
    pub fn time_remaining(env: &Env, transaction_id: u64) -> Result<u64, SettlementError> {
        let swap = Self::get_swap_by_transaction(env, transaction_id)?;
        let config = Self::timeout_config(env);
        Ok(time_utils::remaining_time_with_grace(
            swap.expires_at,
            config.grace_period_seconds,
            env,
        ))
    }

    /// Internal: mark a swap failed, refund its escrow, and emit timeout events.
    fn finalize_expiry(
        env: &Env,
        swap: &mut AtomicSwap,
        config: &SwapTimeoutConfig,
    ) -> Result<u32, SettlementError> {
        crate::events::emit_swap_expired(
            env,
            SwapExpiredEvent {
                swap_id: swap.swap_id,
                transaction_id: swap.transaction_id,
                expires_at: swap.expires_at,
                expires_at_ledger: swap.expires_at_ledger,
                expired_by_seconds: time_utils::overdue_by(
                    swap.expires_at,
                    config.grace_period_seconds,
                    env,
                ),
                ledger: time_utils::current_ledger(env),
                timestamp: env.ledger().timestamp(),
            },
        );

        let refunded = Self::refund_escrow_holdings(env, swap, true)?;
        swap.state = SwapState::Failed;
        Ok(refunded)
    }

    // ── Transfers ────────────────────────────────────────────────────────────

    /// Internal: Transfer assets to escrow
    fn transfer_to_escrow(
        env: &Env,
        from: &Address,
        asset: &Asset,
        amount: i128,
        is_nft: bool,
    ) -> Result<(), SettlementError> {
        if is_nft {
            // Extract contract address from the Token variant (NFT holdings always use Token)
            let nft_contract = match asset {
                Asset::Token(t) => t.contract.clone(),
                Asset::NativeXLM => return Err(SettlementError::InvalidState),
            };
            // Transfer NFT to escrow contract
            asset_utils::transfer_nft(
                &nft_contract,
                from,
                &env.current_contract_address(),
                amount as u64,
                env,
            )?;
        } else {
            // Transfer tokens (or native XLM) to escrow contract
            asset_utils::transfer_tokens(
                asset,
                from,
                &env.current_contract_address(),
                amount,
                env,
            )?;
        }
        Ok(())
    }

    /// Internal: Transfer assets from escrow to recipient
    fn transfer_from_escrow(
        env: &Env,
        to: &Address,
        asset: &Asset,
        amount: i128,
        is_nft: bool,
    ) -> Result<(), SettlementError> {
        if is_nft {
            let nft_contract = match asset {
                Asset::Token(t) => t.contract.clone(),
                Asset::NativeXLM => return Err(SettlementError::InvalidState),
            };
            asset_utils::transfer_nft(
                &nft_contract,
                &env.current_contract_address(),
                to,
                amount as u64,
                env,
            )?;
        } else {
            asset_utils::transfer_tokens(asset, &env.current_contract_address(), to, amount, env)?;
        }
        Ok(())
    }

    /// Internal: Perform the actual atomic swap
    fn perform_atomic_swap(env: &Env, swap: &mut AtomicSwap) -> Result<(), SettlementError> {
        let now = env.ledger().timestamp();
        let mut seller_escrow = swap.seller_escrow.clone();
        let mut buyer_escrow = swap.buyer_escrow.clone();

        // Transfer NFT from seller escrow to buyer
        for i in 0..seller_escrow.len() {
            let mut holding = match seller_escrow.get(i) {
                Some(holding) => holding,
                None => continue,
            };
            if !holding.is_nft || !holding.is_deposited || holding.released_at.is_some() {
                continue;
            }
            // Find corresponding buyer
            if let Some(buyer_holding) = buyer_escrow.get(0) {
                Self::transfer_from_escrow(
                    env,
                    &buyer_holding.holder,
                    &holding.asset,
                    holding.amount,
                    holding.is_nft,
                )?;
                holding.released_at = Some(now);
                seller_escrow.set(i, holding);
            }
        }

        // Transfer payment from buyer escrow to seller
        for i in 0..buyer_escrow.len() {
            let mut holding = match buyer_escrow.get(i) {
                Some(holding) => holding,
                None => continue,
            };
            if holding.is_nft || !holding.is_deposited || holding.released_at.is_some() {
                continue;
            }
            // Find corresponding seller
            if let Some(seller_holding) = seller_escrow.get(0) {
                Self::transfer_from_escrow(
                    env,
                    &seller_holding.holder,
                    &holding.asset,
                    holding.amount,
                    holding.is_nft,
                )?;
                holding.released_at = Some(now);
                buyer_escrow.set(i, holding);
            }
        }

        swap.seller_escrow = seller_escrow;
        swap.buyer_escrow = buyer_escrow;
        Ok(())
    }

    /// Internal: Refund every deposited, unreleased holding.
    fn refund_escrow_holdings(
        env: &Env,
        swap: &mut AtomicSwap,
        emit_auto_refund: bool,
    ) -> Result<u32, SettlementError> {
        Self::refund_holdings(env, swap, emit_auto_refund, false)
    }

    /// Internal: Refund holdings, optionally only those past their own backstop.
    ///
    /// Every refund marks `released_at`, and holdings that are already released — or
    /// were never deposited — are skipped. That is what makes the several refund
    /// entrypoints (cancel, expire, cleanup, reclaim, emergency) safe to call in any
    /// order without paying a holder twice.
    fn refund_holdings(
        env: &Env,
        swap: &mut AtomicSwap,
        emit_auto_refund: bool,
        only_escrow_expired: bool,
    ) -> Result<u32, SettlementError> {
        let swap_id = swap.swap_id;
        let transaction_id = swap.transaction_id;

        let mut seller_escrow = swap.seller_escrow.clone();
        let seller_refunds = Self::refund_holding_vec(
            env,
            swap_id,
            transaction_id,
            &mut seller_escrow,
            emit_auto_refund,
            only_escrow_expired,
        )?;
        swap.seller_escrow = seller_escrow;

        let mut buyer_escrow = swap.buyer_escrow.clone();
        let buyer_refunds = Self::refund_holding_vec(
            env,
            swap_id,
            transaction_id,
            &mut buyer_escrow,
            emit_auto_refund,
            only_escrow_expired,
        )?;
        swap.buyer_escrow = buyer_escrow;

        Ok(seller_refunds + buyer_refunds)
    }

    /// Internal: Refund one side's holdings, returning how many were paid out.
    fn refund_holding_vec(
        env: &Env,
        swap_id: u64,
        transaction_id: u64,
        holdings: &mut Vec<EscrowHolding>,
        emit_auto_refund: bool,
        only_escrow_expired: bool,
    ) -> Result<u32, SettlementError> {
        let now = env.ledger().timestamp();
        let mut refunded = 0u32;

        for i in 0..holdings.len() {
            let mut holding = match holdings.get(i) {
                Some(holding) => holding,
                None => continue,
            };

            if !holding.is_deposited || holding.released_at.is_some() {
                continue;
            }
            if only_escrow_expired && now <= holding.escrow_expires_at {
                continue;
            }

            Self::transfer_from_escrow(
                env,
                &holding.holder,
                &holding.asset,
                holding.amount,
                holding.is_nft,
            )?;

            holding.released_at = Some(now);
            holdings.set(i, holding.clone());
            refunded += 1;

            if emit_auto_refund {
                crate::events::emit_swap_auto_refunded(
                    env,
                    SwapAutoRefundedEvent {
                        swap_id,
                        transaction_id,
                        holder: holding.holder.clone(),
                        asset: holding.asset.clone(),
                        amount: holding.amount,
                        is_nft: holding.is_nft,
                        timestamp: now,
                    },
                );
            }
        }

        Ok(refunded)
    }

    // ── State ────────────────────────────────────────────────────────────────

    /// Internal: Update escrow holding after deposit
    fn update_escrow_holding(
        env: &Env,
        swap: &mut AtomicSwap,
        depositor: &Address,
        asset: &Asset,
        _amount: i128,
        _is_nft: bool,
    ) -> Result<(), SettlementError> {
        let timestamp = env.ledger().timestamp().max(1);

        // Update seller escrow
        let mut seller_escrow = swap.seller_escrow.clone();
        for i in 0..seller_escrow.len() {
            if let Some(mut holding) = seller_escrow.get(i) {
                if holding.holder == *depositor && asset_utils::assets_equal(&holding.asset, asset)
                {
                    holding.is_deposited = true;
                    holding.deposited_at = timestamp;
                    seller_escrow.set(i, holding);
                    break;
                }
            }
        }
        swap.seller_escrow = seller_escrow;

        // Update buyer escrow
        let mut buyer_escrow = swap.buyer_escrow.clone();
        for i in 0..buyer_escrow.len() {
            if let Some(mut holding) = buyer_escrow.get(i) {
                if holding.holder == *depositor && asset_utils::assets_equal(&holding.asset, asset)
                {
                    holding.is_deposited = true;
                    holding.deposited_at = timestamp;
                    buyer_escrow.set(i, holding);
                    break;
                }
            }
        }
        swap.buyer_escrow = buyer_escrow;

        Ok(())
    }

    /// Internal: Update swap state based on escrow status
    fn update_swap_state(_env: &Env, swap: &mut AtomicSwap) -> Result<(), SettlementError> {
        let seller_funded = swap.seller_escrow.iter().all(|h| h.is_deposited);
        let buyer_funded = swap.buyer_escrow.iter().all(|h| h.is_deposited);

        match (seller_funded, buyer_funded) {
            (true, false) => swap.state = SwapState::SellerFunded,
            (false, true) => swap.state = SwapState::BuyerFunded,
            (true, true) => swap.state = SwapState::Ready,
            (false, false) => swap.state = SwapState::Pending,
        }

        Ok(())
    }

    /// Internal: Get next swap ID
    fn next_swap_id(env: &Env) -> u64 {
        let current_id: u64 = env
            .storage()
            .instance()
            .get(&Symbol::new(env, "next_swap"))
            .unwrap_or(1);
        let next_id = current_id + 1;
        env.storage()
            .instance()
            .set(&Symbol::new(env, "next_swap"), &next_id);
        current_id
    }

    /// Internal: Store atomic swap
    fn store_swap(env: &Env, swap: &AtomicSwap) -> Result<(), SettlementError> {
        let mut swaps: Map<u64, AtomicSwap> = env
            .storage()
            .instance()
            .get(&ATOMIC_SWAPS)
            .unwrap_or(Map::new(env));

        swaps.set(swap.swap_id, swap.clone());
        env.storage().instance().set(&ATOMIC_SWAPS, &swaps);
        Ok(())
    }

    /// Get swap by transaction ID
    pub fn get_swap_by_transaction(
        env: &Env,
        transaction_id: u64,
    ) -> Result<AtomicSwap, SettlementError> {
        let swaps: Map<u64, AtomicSwap> = env
            .storage()
            .instance()
            .get(&ATOMIC_SWAPS)
            .ok_or(SettlementError::NotFound)?;

        for (_, swap) in swaps.iter() {
            if swap.transaction_id == transaction_id {
                return Ok(swap);
            }
        }

        Err(SettlementError::NotFound)
    }
}

/// Escrow manager for individual holdings
pub struct EscrowManager;

impl EscrowManager {
    /// Check escrow balance for a transaction
    pub fn check_escrow_balance(
        _env: &Env,
        _transaction_id: u64,
        _asset: &Asset,
    ) -> Result<i128, SettlementError> {
        // This would query the escrow holdings
        // For now, return a placeholder
        Ok(0)
    }

    /// Release escrow to specific address
    pub fn release_escrow(
        env: &Env,
        _transaction_id: u64,
        to: &Address,
        asset: &Asset,
        amount: i128,
    ) -> Result<(), SettlementError> {
        asset_utils::transfer_tokens(asset, &env.current_contract_address(), to, amount, env)
    }

    /// Get escrow holdings for a transaction
    pub fn get_escrow_holdings(env: &Env, transaction_id: u64) -> Vec<EscrowHolding> {
        match AtomicSwapEngine::get_swap_by_transaction(env, transaction_id) {
            Ok(swap) => {
                let mut holdings = Vec::new(env);
                for holding in swap.seller_escrow.iter() {
                    holdings.push_back(holding);
                }
                for holding in swap.buyer_escrow.iter() {
                    holdings.push_back(holding);
                }
                holdings
            }
            Err(_) => Vec::new(env),
        }
    }
}
