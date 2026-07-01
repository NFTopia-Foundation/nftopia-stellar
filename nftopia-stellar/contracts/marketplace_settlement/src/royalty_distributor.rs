use crate::error::SettlementError;
use crate::events::{emit_royalties_distributed, RoyaltiesDistributedEvent};
use crate::types::{Asset, DistributionResult, RoyaltyDistribution};
use crate::utils::asset_utils;
use crate::utils::math_utils;
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Map, Symbol, Vec};

// Storage keys
const ROYALTY_CONFIGS: Symbol = symbol_short!("roy_cfgs");

// Type alias for royalty key
type RoyaltyKey = Bytes;

/// Royalty information for an NFT
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltyInfo {
    pub nft_contract: Address,
    pub token_id: u64,
    pub creator: Address,
    pub royalty_percentage: u64, // Basis points (10000 = 100%)
    pub last_updated: u64,
}

/// Royalty distributor for handling royalty payments
pub struct RoyaltyDistributor;

impl RoyaltyDistributor {
    /// Calculate royalties for an NFT sale.
    /// Royalty is calculated on the full sale price, then seller and platform
    /// fees are calculated only on the post-royalty remainder.
    pub fn calculate_royalties(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
        sale_price: i128,
        seller: &Address,
        platform_address: &Address,
    ) -> Result<RoyaltyDistribution, SettlementError> {
        let royalty_info = Self::get_royalty_info(env, nft_contract, token_id)?;

        // Calculate royalty amount on full sale price (rounds in creator's favor via half-up)
        let royalty_amount =
            math_utils::calculate_percentage(sale_price, royalty_info.royalty_percentage, env)?;

        // Post-royalty remainder: seller and platform split only this amount
        let remainder = math_utils::safe_sub(sale_price, royalty_amount, env)?;

        let seller_percentage = 9500u64; // 95% of remainder
        let platform_percentage = 500u64; // 5% of remainder

        // Platform fee calculated on the remainder (not the full sale price)
        let platform_amount =
            math_utils::calculate_percentage(remainder, platform_percentage, env)?;
        let seller_amount = math_utils::safe_sub(remainder, platform_amount, env)?;

        // Add all amounts to the distribution map
        let mut amounts = Map::new(env);
        amounts.set(royalty_info.creator.clone(), royalty_amount);
        amounts.set(seller.clone(), seller_amount);
        amounts.set(platform_address.clone(), platform_amount);

        Ok(RoyaltyDistribution {
            creator_address: royalty_info.creator,
            creator_percentage: royalty_info.royalty_percentage,
            seller_address: seller.clone(),
            seller_percentage,
            platform_address: platform_address.clone(),
            platform_percentage,
            total_amount: sale_price,
            amounts,
        })
    }

    /// Distribute royalties for a transaction.
    /// Validates the distribution sums to total before any transfer.
    /// Fails the entire transaction if any individual transfer fails.
    pub fn distribute_royalties(
        env: &Env,
        transaction_id: u64,
        royalty_distribution: &RoyaltyDistribution,
        payment_asset: &Asset,
    ) -> Result<DistributionResult, SettlementError> {
        // Validate distribution sums before any transfer
        Self::validate_royalty_distribution(env, royalty_distribution)?;

        let mut total_distributed = 0i128;

        // Distribute to each recipient — fail entire tx if any transfer fails
        for (recipient, amount) in royalty_distribution.amounts.iter() {
            asset_utils::transfer_tokens(
                &payment_asset.contract,
                &env.current_contract_address(),
                &recipient,
                amount,
                env,
            )?;
            total_distributed = math_utils::safe_add(total_distributed, amount, env)?;
        }

        // Look up amounts from the distribution map using stored addresses
        let creator_amount = royalty_distribution
            .amounts
            .get(royalty_distribution.creator_address.clone())
            .unwrap_or(0);
        let seller_amount = royalty_distribution
            .amounts
            .get(royalty_distribution.seller_address.clone())
            .unwrap_or(0);
        let platform_amount = royalty_distribution
            .amounts
            .get(royalty_distribution.platform_address.clone())
            .unwrap_or(0);

        let result = DistributionResult {
            transaction_id,
            total_amount: royalty_distribution.total_amount,
            creator_amount,
            seller_amount,
            platform_amount,
            distribution_success: true,
            timestamp: env.ledger().timestamp(),
        };

        // Emit distribution event
        let event = RoyaltiesDistributedEvent {
            transaction_id,
            nft_address: royalty_distribution.creator_address.clone(),
            token_id: 0,
            creator: royalty_distribution.creator_address.clone(),
            creator_amount,
            seller_amount,
            platform_amount,
            total_amount: result.total_amount,
            timestamp: result.timestamp,
        };
        emit_royalties_distributed(env, event);

        Ok(result)
    }

    /// Set royalty information for an NFT
    pub fn set_royalty_info(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
        creator: &Address,
        royalty_percentage: u64,
        _setter: &Address,
    ) -> Result<(), SettlementError> {
        // Validate royalty percentage (max 50%)
        if royalty_percentage > 5000 {
            return Err(SettlementError::InvalidRoyaltyPercentage);
        }

        let royalty_info = RoyaltyInfo {
            nft_contract: nft_contract.clone(),
            token_id,
            creator: creator.clone(),
            royalty_percentage,
            last_updated: env.ledger().timestamp(),
        };

        Self::store_royalty_info(env, &royalty_info)?;
        Ok(())
    }

    /// Get royalty information for an NFT
    pub fn get_royalty_info(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
    ) -> Result<RoyaltyInfo, SettlementError> {
        let key = Self::make_royalty_key(env, nft_contract, token_id);
        let royalty_configs: Map<RoyaltyKey, RoyaltyInfo> = env
            .storage()
            .instance()
            .get(&ROYALTY_CONFIGS)
            .unwrap_or(Map::new(env));

        match royalty_configs.get(key) {
            Some(info) => Ok(info),
            None => Err(SettlementError::NotFound),
        }
    }

    /// Update royalty percentage for an NFT
    pub fn update_royalty_percentage(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
        new_percentage: u64,
        updater: &Address,
    ) -> Result<(), SettlementError> {
        let mut royalty_info = Self::get_royalty_info(env, nft_contract, token_id)?;

        // Check authorization (only creator can update)
        if royalty_info.creator != *updater {
            return Err(SettlementError::Unauthorized);
        }

        // Validate new percentage
        if new_percentage > 5000 {
            return Err(SettlementError::InvalidRoyaltyPercentage);
        }

        royalty_info.royalty_percentage = new_percentage;
        royalty_info.last_updated = env.ledger().timestamp();

        Self::store_royalty_info(env, &royalty_info)?;
        Ok(())
    }

    /// Calculate royalty splits for complex transactions (bundles).
    /// Uses value-proportional splitting based on `value_weights` rather than equal division.
    pub fn calculate_complex_royalties(
        env: &Env,
        nft_contracts: &Vec<Address>,
        token_ids: &Vec<u64>,
        sale_price: i128,
        seller: &Address,
        platform_address: &Address,
        value_weights: &Vec<i128>,
    ) -> Result<RoyaltyDistribution, SettlementError> {
        if nft_contracts.len() != token_ids.len() {
            return Err(SettlementError::InvalidAmount);
        }
        if nft_contracts.len() != value_weights.len() {
            return Err(SettlementError::InvalidAmount);
        }

        // Calculate total weight for proportional distribution
        let mut total_weight: i128 = 0;
        for w in value_weights.iter() {
            total_weight = math_utils::safe_add(total_weight, w, env)?;
        }

        let mut total_royalty_amount = 0i128;
        let mut amounts = Map::new(env);

        // Calculate royalties for each NFT proportionally by value weight
        for i in 0..nft_contracts.len() {
            let nft_contract = nft_contracts.get(i).ok_or(SettlementError::InvalidAmount)?;
            let token_id = token_ids.get(i).ok_or(SettlementError::InvalidAmount)?;
            let weight = value_weights.get(i).ok_or(SettlementError::InvalidAmount)?;

            let royalty_info = Self::get_royalty_info(env, &nft_contract, token_id)?;

            // Calculate proportional price: sale_price * weight / total_weight
            let individual_price = if total_weight > 0 {
                math_utils::calculate_percentage_with_rounding_and_basis(
                    sale_price,
                    weight as u64,
                    math_utils::RoundingMode::HalfUp,
                    total_weight as u64,
                    env,
                )?
            } else {
                math_utils::safe_div(sale_price, nft_contracts.len() as i128, env)?
            };

            let royalty_amount = math_utils::calculate_percentage(
                individual_price,
                royalty_info.royalty_percentage,
                env,
            )?;

            // Aggregate by creator
            let current_amount = amounts.get(royalty_info.creator.clone()).unwrap_or(0);
            let new_amount = math_utils::safe_add(current_amount, royalty_amount, env)?;
            amounts.set(royalty_info.creator, new_amount);

            total_royalty_amount = math_utils::safe_add(total_royalty_amount, royalty_amount, env)?;
        }

        // Calculate remaining amounts for seller and platform on post-royalty remainder
        let remainder = math_utils::safe_sub(sale_price, total_royalty_amount, env)?;
        let platform_percentage = 500u64; // 5%
        let platform_amount =
            math_utils::calculate_percentage(remainder, platform_percentage, env)?;
        let seller_amount = math_utils::safe_sub(remainder, platform_amount, env)?;

        // Use real addresses passed as parameters
        amounts.set(seller.clone(), seller_amount);
        amounts.set(platform_address.clone(), platform_amount);

        Ok(RoyaltyDistribution {
            creator_address: seller.clone(), // Fallback — multiple creators in amounts map
            creator_percentage: 0,
            seller_address: seller.clone(),
            seller_percentage: 9500,
            platform_address: platform_address.clone(),
            platform_percentage: 500,
            total_amount: sale_price,
            amounts,
        })
    }

    /// Validate royalty distribution adds up correctly
    pub fn validate_royalty_distribution(
        env: &Env,
        distribution: &RoyaltyDistribution,
    ) -> Result<(), SettlementError> {
        let mut total_distributed = 0i128;

        for (_, amount) in distribution.amounts.iter() {
            total_distributed = math_utils::safe_add(total_distributed, amount, env)?;
        }

        if total_distributed != distribution.total_amount {
            return Err(SettlementError::InvalidAmount);
        }

        Ok(())
    }

    /// Get royalty history for an NFT
    pub fn get_royalty_history(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
    ) -> Vec<RoyaltyInfo> {
        // This would store historical royalty information
        // For now, just return current
        match Self::get_royalty_info(env, nft_contract, token_id) {
            Ok(info) => {
                let mut result = Vec::new(env);
                result.push_back(info);
                result
            }
            Err(_) => Vec::new(env),
        }
    }

    /// Bulk set royalties for multiple NFTs
    pub fn bulk_set_royalties(
        env: &Env,
        nft_contract: &Address,
        token_ids: &Vec<u64>,
        creator: &Address,
        royalty_percentage: u64,
        setter: &Address,
    ) -> Result<(), SettlementError> {
        for token_id in token_ids.iter() {
            Self::set_royalty_info(
                env,
                nft_contract,
                token_id,
                creator,
                royalty_percentage,
                setter,
            )?;
        }
        Ok(())
    }

    /// Internal: Create storage key for royalty info
    fn make_royalty_key(env: &Env, _nft_contract: &Address, _token_id: u64) -> RoyaltyKey {
        Bytes::new(env)
    }

    /// Internal: Store royalty information
    fn store_royalty_info(env: &Env, royalty_info: &RoyaltyInfo) -> Result<(), SettlementError> {
        let mut royalty_configs: Map<RoyaltyKey, RoyaltyInfo> = env
            .storage()
            .instance()
            .get(&ROYALTY_CONFIGS)
            .unwrap_or(Map::new(env));

        let key = Self::make_royalty_key(env, &royalty_info.nft_contract, royalty_info.token_id);
        royalty_configs.set(key, royalty_info.clone());

        env.storage()
            .instance()
            .set(&ROYALTY_CONFIGS, &royalty_configs);
        Ok(())
    }
}

/// Royalty enforcement for ensuring royalties are paid
pub struct RoyaltyEnforcer;

impl RoyaltyEnforcer {
    /// Enforce royalty payment before transfer
    pub fn enforce_royalty_payment(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
        sale_price: i128,
        _payment_asset: &Asset,
        seller: &Address,
        platform_address: &Address,
    ) -> Result<(), SettlementError> {
        let royalty_distribution = RoyaltyDistributor::calculate_royalties(
            env,
            nft_contract,
            token_id,
            sale_price,
            seller,
            platform_address,
        )?;

        // Check if sufficient funds are available for royalties
        let royalty_amount = math_utils::calculate_percentage(
            sale_price,
            royalty_distribution.creator_percentage,
            env,
        )?;

        // Verify payment can cover royalties
        if sale_price < royalty_amount {
            return Err(SettlementError::InsufficientFunds);
        }

        Ok(())
    }

    /// Verify royalty payment was made
    pub fn verify_royalty_payment(
        _env: &Env,
        _transaction_id: u64,
        _expected_distribution: &RoyaltyDistribution,
    ) -> Result<bool, SettlementError> {
        // This would check if royalties were actually distributed
        // For now, return true
        Ok(true)
    }

    /// Calculate minimum price needed to cover royalties
    pub fn calculate_minimum_price(
        env: &Env,
        nft_contract: &Address,
        token_id: u64,
        desired_net_amount: i128,
    ) -> Result<i128, SettlementError> {
        let royalty_info = RoyaltyDistributor::get_royalty_info(env, nft_contract, token_id)?;

        // Price = desired_net_amount / (1 - royalty_percentage)
        let royalty_decimal = royalty_info.royalty_percentage as i128;
        let denominator = math_utils::safe_sub(10000, royalty_decimal, env)?;
        let price = math_utils::safe_div(
            math_utils::safe_mul(desired_net_amount, 10000, env)?,
            denominator,
            env,
        )?;

        Ok(price)
    }
}
