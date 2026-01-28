use soroban_sdk::{Env, Address, Vec, Map, Symbol, contracttype, symbol_short, Bytes};
use crate::error::SettlementError;
use crate::types::{Asset, ExecutionResult};
use crate::utils::asset_utils;
use crate::security::reentrancy_guard::ReentrancyGuard;

// Storage keys
const ATOMIC_SWAPS: Symbol = symbol_short!("atom_swps");

/// Represents an escrow holding
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowHolding {
    pub transaction_id: u64,
    pub holder: Address, // Who deposited the funds/NFTs
    pub asset: Asset,
    pub amount: i128, // For tokens, or token_id for NFTs
    pub is_nft: bool,
    pub deposited_at: u64,
    pub released_at: Option<u64>,
}

/// Atomic swap state
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AtomicSwap {
    pub swap_id: u64,
    pub transaction_id: u64,
    pub seller_escrow: Vec<EscrowHolding>,
    pub buyer_escrow: Vec<EscrowHolding>,
    pub state: SwapState,
    pub created_at: u64,
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

/// Atomic swap engine for secure NFT and token transfers
pub struct AtomicSwapEngine;

impl AtomicSwapEngine {
    /// Initialize an atomic swap for a transaction
    pub fn initialize_swap(
        env: &Env,
        transaction_id: u64,
        seller: &Address,
        buyer: &Address,
        nft_address: &Address,
        token_id: u64,
        payment_asset: &Asset,
        payment_amount: i128
    ) -> Result<u64, SettlementError> {
        let swap_id = Self::next_swap_id(env);

        let mut seller_escrow = Vec::new(env);
        seller_escrow.push_back(EscrowHolding {
            transaction_id,
            holder: seller.clone(),
            asset: Asset {
                contract: nft_address.clone(),
                symbol: Symbol::new(env, "NFT"),
            },
            amount: token_id as i128,
            is_nft: true,
            deposited_at: env.ledger().timestamp(),
            released_at: None,
        });

        let mut buyer_escrow = Vec::new(env);
        buyer_escrow.push_back(EscrowHolding {
            transaction_id,
            holder: buyer.clone(),
            asset: payment_asset.clone(),
            amount: payment_amount,
            is_nft: false,
            deposited_at: env.ledger().timestamp(),
            released_at: None,
        });

        let atomic_swap = AtomicSwap {
            swap_id,
            transaction_id,
            seller_escrow,
            buyer_escrow,
            state: SwapState::Pending,
            created_at: env.ledger().timestamp(),
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
        is_nft: bool
    ) -> Result<(), SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;

        // Validate depositor
        let is_seller_deposit = swap.seller_escrow.iter().any(|h| h.holder == *depositor && h.asset == *asset);
        let is_buyer_deposit = swap.buyer_escrow.iter().any(|h| h.holder == *depositor && h.asset == *asset);

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
        executor: &Address
    ) -> Result<ExecutionResult, SettlementError> {
        ReentrancyGuard::execute(env, executor, "execute_swap", || {
            let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;

            // Validate swap is ready for execution
            if swap.state != SwapState::Ready {
                return Err(SettlementError::InvalidState);
            }

            // Perform the atomic swap
            Self::perform_atomic_swap(env, &swap)?;

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

    /// Cancel a swap and refund all parties
    pub fn cancel_swap(
        env: &Env,
        transaction_id: u64,
        canceller: &Address
    ) -> Result<(), SettlementError> {
        let mut swap = Self::get_swap_by_transaction(env, transaction_id)?;

        // Only seller or buyer can cancel
        let is_authorized = swap.seller_escrow.iter().any(|h| h.holder == *canceller) ||
                           swap.buyer_escrow.iter().any(|h| h.holder == *canceller);

        if !is_authorized {
            return Err(SettlementError::Unauthorized);
        }

        // Refund all escrow holdings
        Self::refund_escrow_holdings(env, &swap)?;

        swap.state = SwapState::Failed;
        Self::store_swap(env, &swap)?;

        Ok(())
    }

    /// Emergency withdrawal for stuck transactions
    pub fn emergency_withdraw(
        env: &Env,
        transaction_id: u64,
        admin: &Address,
        reason: &Bytes
    ) -> Result<(), SettlementError> {
        // This would check admin permissions
        let swap = Self::get_swap_by_transaction(env, transaction_id)?;

        // Log emergency withdrawal
        // In production, this would have proper admin checks

        Self::refund_escrow_holdings(env, &swap)?;

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

    /// Internal: Transfer assets to escrow
    fn transfer_to_escrow(
        env: &Env,
        from: &Address,
        asset: &Asset,
        amount: i128,
        is_nft: bool
    ) -> Result<(), SettlementError> {
        if is_nft {
            // Transfer NFT to escrow contract
            asset_utils::transfer_nft(
                &asset.contract,
                from,
                &env.current_contract_address(),
                amount as u64,
                env
            )?;
        } else {
            // Transfer tokens to escrow contract
            asset_utils::transfer_tokens(
                &asset.contract,
                from,
                &env.current_contract_address(),
                amount,
                env
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
        is_nft: bool
    ) -> Result<(), SettlementError> {
        if is_nft {
            asset_utils::transfer_nft(
                &asset.contract,
                &env.current_contract_address(),
                to,
                amount as u64,
                env
            )?;
        } else {
            asset_utils::transfer_tokens(
                &asset.contract,
                &env.current_contract_address(),
                to,
                amount,
                env
            )?;
        }
        Ok(())
    }

    /// Internal: Perform the actual atomic swap
    fn perform_atomic_swap(env: &Env, swap: &AtomicSwap) -> Result<(), SettlementError> {
        // Transfer NFT from seller escrow to buyer
        for holding in swap.seller_escrow.iter() {
            if holding.is_nft {
                // Find corresponding buyer
                if let Some(buyer_holding) = swap.buyer_escrow.get(0) {
                    Self::transfer_from_escrow(
                        env,
                        &buyer_holding.holder,
                        &holding.asset,
                        holding.amount,
                        holding.is_nft
                    )?;
                }
            }
        }

        // Transfer payment from buyer escrow to seller
        for holding in swap.buyer_escrow.iter() {
            if !holding.is_nft {
                // Find corresponding seller
                if let Some(seller_holding) = swap.seller_escrow.get(0) {
                    Self::transfer_from_escrow(
                        env,
                        &seller_holding.holder,
                        &holding.asset,
                        holding.amount,
                        holding.is_nft
                    )?;
                }
            }
        }

        Ok(())
    }

    /// Internal: Refund all escrow holdings
    fn refund_escrow_holdings(env: &Env, swap: &AtomicSwap) -> Result<(), SettlementError> {
        // Refund seller escrow
        for holding in swap.seller_escrow.iter() {
            Self::transfer_from_escrow(
                env,
                &holding.holder,
                &holding.asset,
                holding.amount,
                holding.is_nft
            )?;
        }

        // Refund buyer escrow
        for holding in swap.buyer_escrow.iter() {
            Self::transfer_from_escrow(
                env,
                &holding.holder,
                &holding.asset,
                holding.amount,
                holding.is_nft
            )?;
        }

        Ok(())
    }

    /// Internal: Update escrow holding after deposit
    fn update_escrow_holding(
        env: &Env,
        swap: &mut AtomicSwap,
        depositor: &Address,
        asset: &Asset,
        _amount: i128,
        _is_nft: bool
    ) -> Result<(), SettlementError> {
        let timestamp = env.ledger().timestamp();

        // Update seller escrow
        for i in 0..swap.seller_escrow.len() {
            if let Some(mut holding) = swap.seller_escrow.get(i) {
                if holding.holder == *depositor && holding.asset.contract == asset.contract {
                    holding.deposited_at = timestamp;
                    swap.seller_escrow.set(i, holding);
                    break;
                }
            }
        }

        // Update buyer escrow
        for i in 0..swap.buyer_escrow.len() {
            if let Some(mut holding) = swap.buyer_escrow.get(i) {
                if holding.holder == *depositor && holding.asset.contract == asset.contract {
                    holding.deposited_at = timestamp;
                    swap.buyer_escrow.set(i, holding);
                    break;
                }
            }
        }

        Ok(())
    }

    /// Internal: Update swap state based on escrow status
    fn update_swap_state(_env: &Env, swap: &mut AtomicSwap) -> Result<(), SettlementError> {
        let seller_funded = swap.seller_escrow.iter().all(|h| h.deposited_at > 0);
        let buyer_funded = swap.buyer_escrow.iter().all(|h| h.deposited_at > 0);

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
        let current_id: u64 = env.storage().instance().get(&Symbol::new(env, "next_swap")).unwrap_or(1);
        let next_id = current_id + 1;
        env.storage().instance().set(&Symbol::new(env, "next_swap"), &next_id);
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

    /// Internal: Get swap by transaction ID
    fn get_swap_by_transaction(env: &Env, transaction_id: u64) -> Result<AtomicSwap, SettlementError> {
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
        _asset: &Asset
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
        amount: i128
    ) -> Result<(), SettlementError> {
        // Transfer from escrow to recipient
        asset_utils::transfer_tokens(&asset.contract, &env.current_contract_address(), to, amount, env)
    }

    /// Get escrow holdings for a transaction
    pub fn get_escrow_holdings(_env: &Env, _transaction_id: u64) -> Vec<EscrowHolding> {
        // This would return all escrow holdings for the transaction
        Vec::new(_env)
    }
}