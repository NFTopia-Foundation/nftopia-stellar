use crate::error::SettlementError;
use crate::events::{emit_platform_fees_collected, PlatformFeesCollectedEvent};
use crate::types::{Asset, FeeConfig, VolumeTier};
use crate::utils::math_utils;
use soroban_sdk::{symbol_short, Address, Env, Map, Symbol, Vec};

// Storage keys
const FEE_CONFIG: Symbol = symbol_short!("fee_cfg");
const ACCUMULATED_FEES: Symbol = symbol_short!("acc_fees");
const USER_VOLUMES: Symbol = symbol_short!("usr_vol");

/// Fee manager for handling platform fees and fee distribution
pub struct FeeManager;

impl FeeManager {
    /// Calculate fee for a transaction
    pub fn calculate_fee(
        env: &Env,
        transaction_amount: i128,
        user: &Address,
    ) -> Result<i128, SettlementError> {
        let fee_config = Self::get_fee_config(env)?;

        if !fee_config.dynamic_fee_enabled {
            // Simple fee calculation
            return math_utils::calculate_fee(
                transaction_amount,
                fee_config.platform_fee_bps,
                fee_config.minimum_fee,
                fee_config.maximum_fee,
                env,
            );
        }

        // Dynamic fee calculation based on user volume
        Self::calculate_dynamic_fee(env, transaction_amount, user, &fee_config)
    }

    /// Calculate dynamic fee based on user trading volume
    fn calculate_dynamic_fee(
        env: &Env,
        transaction_amount: i128,
        user: &Address,
        fee_config: &FeeConfig,
    ) -> Result<i128, SettlementError> {
        let user_volume = Self::get_user_volume(env, user)?;
        let discount_bps: u64 =
            Self::calculate_volume_discount(user_volume, &fee_config.volume_discounts)?;

        // Apply discount to base fee
        let discounted_fee_bps = fee_config.platform_fee_bps.saturating_sub(discount_bps);

        // Check for VIP exemptions
        if fee_config.vip_exemptions.contains(user.clone()) {
            return Ok(0);
        }

        math_utils::calculate_fee(
            transaction_amount,
            discounted_fee_bps,
            fee_config.minimum_fee,
            fee_config.maximum_fee,
            env,
        )
    }

    /// Collect platform fee
    pub fn collect_platform_fee(
        env: &Env,
        amount: i128,
        asset: &Asset,
        collector: &Address,
    ) -> Result<(), SettlementError> {
        // Add to accumulated fees
        let mut accumulated_fees: Map<Asset, i128> = env
            .storage()
            .instance()
            .get(&ACCUMULATED_FEES)
            .unwrap_or(Map::new(env));

        let current_amount = accumulated_fees.get(asset.clone()).unwrap_or(0);
        let new_amount = math_utils::safe_add(current_amount, amount, env)?;

        accumulated_fees.set(asset.clone(), new_amount);
        env.storage()
            .instance()
            .set(&ACCUMULATED_FEES, &accumulated_fees);

        // Update user volume for dynamic fees
        Self::update_user_volume(env, collector, amount)?;

        // Emit fee collection event
        let event = PlatformFeesCollectedEvent {
            amount,
            currency: asset.clone(),
            collector: collector.clone(),
            timestamp: env.ledger().timestamp(),
        };
        emit_platform_fees_collected(env, event);

        Ok(())
    }

    /// Withdraw accumulated platform fees
    pub fn withdraw_platform_fees(
        env: &Env,
        asset: &Asset,
        recipient: &Address,
        admin: &Address,
    ) -> Result<i128, SettlementError> {
        let fee_config = Self::get_fee_config(env)?;

        // Check admin authorization
        if fee_config.fee_recipient != *admin {
            return Err(SettlementError::Unauthorized);
        }

        let mut accumulated_fees: Map<Asset, i128> = env
            .storage()
            .instance()
            .get(&ACCUMULATED_FEES)
            .unwrap_or(Map::new(env));

        let amount = accumulated_fees.get(asset.clone()).unwrap_or(0);

        if amount <= 0 {
            return Err(SettlementError::InsufficientFunds);
        }

        // Transfer fees to recipient
        crate::utils::asset_utils::transfer_tokens(
            &asset.contract,
            &env.current_contract_address(),
            recipient,
            amount,
            env,
        )?;

        // Reset accumulated fees
        accumulated_fees.set(asset.clone(), 0);
        env.storage()
            .instance()
            .set(&ACCUMULATED_FEES, &accumulated_fees);

        Ok(amount)
    }

    /// Update fee configuration
    pub fn update_fee_config(
        env: &Env,
        new_config: &FeeConfig,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        // Validate fee configuration
        Self::validate_fee_config(new_config)?;

        env.storage().instance().set(&FEE_CONFIG, new_config);

        // Emit configuration update event
        crate::events::emit_fee_config_updated(
            env,
            crate::events::FeeConfigUpdatedEvent {
                new_config: new_config.clone(),
                updated_by: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Get current fee configuration
    pub fn get_fee_config(env: &Env) -> Result<FeeConfig, SettlementError> {
        env.storage()
            .instance()
            .get(&FEE_CONFIG)
            .ok_or(SettlementError::NotFound)
    }

    /// Add VIP exemption
    pub fn add_vip_exemption(
        env: &Env,
        user: &Address,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        let mut fee_config = Self::get_fee_config(env)?;
        // Check admin permissions here

        if !fee_config.vip_exemptions.contains(user.clone()) {
            fee_config.vip_exemptions.push_back(user.clone());
            Self::update_fee_config(env, &fee_config, admin)?;
        }

        Ok(())
    }

    /// Remove VIP exemption
    pub fn remove_vip_exemption(
        env: &Env,
        user: &Address,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        let mut fee_config = Self::get_fee_config(env)?;
        // Check admin permissions here

        let mut new_exemptions = Vec::new(env);
        for exemption in fee_config.vip_exemptions.iter() {
            if exemption != *user {
                new_exemptions.push_back(exemption);
            }
        }

        fee_config.vip_exemptions = new_exemptions;
        Self::update_fee_config(env, &fee_config, admin)?;

        Ok(())
    }

    /// Get accumulated fees for an asset
    pub fn get_accumulated_fees(env: &Env, asset: &Asset) -> i128 {
        let accumulated_fees: Map<Asset, i128> = env
            .storage()
            .instance()
            .get(&ACCUMULATED_FEES)
            .unwrap_or(Map::new(env));

        accumulated_fees.get(asset.clone()).unwrap_or(0)
    }

    /// Get user trading volume
    pub fn get_user_volume(env: &Env, user: &Address) -> Result<i128, SettlementError> {
        let user_volumes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&USER_VOLUMES)
            .unwrap_or(Map::new(env));

        Ok(user_volumes.get(user.clone()).unwrap_or(0))
    }

    /// Calculate volume-based discount
    fn calculate_volume_discount(
        volume: i128,
        tiers: &Vec<VolumeTier>,
    ) -> Result<u64, SettlementError> {
        for tier in tiers.iter() {
            if volume >= tier.min_volume {
                return Ok(tier.fee_discount_bps);
            }
        }
        Ok(0)
    }

    /// Update user trading volume
    fn update_user_volume(env: &Env, user: &Address, amount: i128) -> Result<(), SettlementError> {
        let mut user_volumes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&USER_VOLUMES)
            .unwrap_or(Map::new(env));

        let current_volume = user_volumes.get(user.clone()).unwrap_or(0);
        let new_volume = math_utils::safe_add(current_volume, amount, env)?;

        user_volumes.set(user.clone(), new_volume);
        env.storage().instance().set(&USER_VOLUMES, &user_volumes);

        Ok(())
    }

    /// Validate fee configuration
    fn validate_fee_config(config: &FeeConfig) -> Result<(), SettlementError> {
        // Validate percentages
        if config.platform_fee_bps > 10000 {
            return Err(SettlementError::InvalidFeeConfig);
        }

        // Validate minimum < maximum if maximum is set
        if config.maximum_fee > 0 && config.minimum_fee >= config.maximum_fee {
            return Err(SettlementError::InvalidFeeConfig);
        }

        // Validate volume tiers are ordered correctly
        let mut prev_volume = 0i128;
        for tier in config.volume_discounts.iter() {
            if tier.min_volume <= prev_volume {
                return Err(SettlementError::InvalidFeeConfig);
            }
            if tier.fee_discount_bps > config.platform_fee_bps {
                return Err(SettlementError::InvalidFeeConfig);
            }
            prev_volume = tier.min_volume;
        }

        Ok(())
    }

    /// Reset user volume (admin function)
    pub fn reset_user_volume(
        env: &Env,
        user: &Address,
        _admin: &Address,
    ) -> Result<(), SettlementError> {
        // Check admin permissions here
        let mut user_volumes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&USER_VOLUMES)
            .unwrap_or(Map::new(env));

        user_volumes.set(user.clone(), 0);
        env.storage().instance().set(&USER_VOLUMES, &user_volumes);

        Ok(())
    }

    /// Get fee statistics
    pub fn get_fee_statistics(env: &Env) -> FeeStatistics {
        let accumulated_fees: Map<Asset, i128> = env
            .storage()
            .instance()
            .get(&ACCUMULATED_FEES)
            .unwrap_or(Map::new(env));

        let user_volumes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&USER_VOLUMES)
            .unwrap_or(Map::new(env));

        let total_users = user_volumes.len();
        let mut total_volume = 0i128;

        for (_, volume) in user_volumes.iter() {
            total_volume += volume;
        }

        FeeStatistics {
            total_accumulated_fees: accumulated_fees,
            total_users: total_users as u64,
            total_volume,
        }
    }
}

impl FeeConfig {
    /// Create a new fee configuration
    pub fn new(fee_recipient: Address, env: &Env) -> Self {
        Self {
            platform_fee_bps: 250, // 2.5%
            minimum_fee: 1000,     // Minimum 1000 units
            maximum_fee: 1000000,  // Maximum 1M units
            fee_recipient,
            dynamic_fee_enabled: true,
            volume_discounts: {
                let mut discounts = Vec::new(env);
                discounts.push_back(VolumeTier {
                    min_volume: 1000000,  // 1M volume
                    fee_discount_bps: 50, // 0.5% discount
                });
                discounts.push_back(VolumeTier {
                    min_volume: 10000000,  // 10M volume
                    fee_discount_bps: 100, // 1% discount
                });
                discounts
            },
            vip_exemptions: Vec::new(env),
        }
    }
}

/// Fee statistics structure
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeStatistics {
    pub total_accumulated_fees: Map<Asset, i128>,
    pub total_users: u64,
    pub total_volume: i128,
}

/// Fee calculator for complex fee structures
pub struct FeeCalculator;

impl FeeCalculator {
    /// Calculate tiered fees based on transaction size
    pub fn calculate_tiered_fee(
        env: &Env,
        amount: i128,
        tiers: &Vec<(i128, u64)>, // (min_amount, fee_bps)
    ) -> Result<i128, SettlementError> {
        for (min_amount, fee_bps) in tiers.iter() {
            if amount >= min_amount {
                return math_utils::calculate_percentage(amount, fee_bps, env);
            }
        }
        Ok(0)
    }

    /// Calculate time-based fees (lower fees during certain hours)
    pub fn calculate_time_based_fee(
        env: &Env,
        base_fee: i128,
        current_hour: u64,
    ) -> Result<i128, SettlementError> {
        // Lower fees during off-peak hours (e.g., 2-6 AM)
        let discount = if (2..=6).contains(&current_hour) {
            25 // 25% discount
        } else {
            0
        };

        let discount_amount = math_utils::calculate_percentage(base_fee, discount, env)?;
        math_utils::safe_sub(base_fee, discount_amount, env)
    }

    /// Calculate bundle fees (discounts for multiple items)
    pub fn calculate_bundle_fee(
        env: &Env,
        individual_fees: &Vec<i128>,
        bundle_discount_bps: u64,
    ) -> Result<i128, SettlementError> {
        let mut total_fee = 0i128;
        for fee in individual_fees.iter() {
            total_fee = math_utils::safe_add(total_fee, fee, env)?;
        }

        let discount = math_utils::calculate_percentage(total_fee, bundle_discount_bps, env)?;
        math_utils::safe_sub(total_fee, discount, env)
    }
}
