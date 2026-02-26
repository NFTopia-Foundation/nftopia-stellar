use crate::error::SettlementError;
use soroban_sdk::{Env, Vec};

/// Safe multiplication that checks for overflow
pub fn safe_mul(a: i128, b: i128, _env: &Env) -> Result<i128, SettlementError> {
    match a.checked_mul(b) {
        Some(result) => Ok(result),
        None => Err(SettlementError::Overflow),
    }
}

/// Safe addition that checks for overflow
pub fn safe_add(a: i128, b: i128, _env: &Env) -> Result<i128, SettlementError> {
    match a.checked_add(b) {
        Some(result) => Ok(result),
        None => Err(SettlementError::Overflow),
    }
}

/// Safe subtraction that checks for underflow
pub fn safe_sub(a: i128, b: i128, _env: &Env) -> Result<i128, SettlementError> {
    match a.checked_sub(b) {
        Some(result) => Ok(result),
        None => Err(SettlementError::Underflow),
    }
}

/// Safe division that checks for division by zero
pub fn safe_div(a: i128, b: i128, _env: &Env) -> Result<i128, SettlementError> {
    if b == 0 {
        return Err(SettlementError::DivisionByZero);
    }
    Ok(a / b)
}

/// Calculate percentage using basis points (10000 = 100%)
pub fn calculate_percentage(
    amount: i128,
    basis_points: u64,
    env: &Env,
) -> Result<i128, SettlementError> {
    if basis_points > 10000 {
        return Err(SettlementError::InvalidRoyaltyPercentage);
    }

    // amount * basis_points / 10000
    let scaled_amount = safe_mul(amount, basis_points as i128, env)?;
    safe_div(scaled_amount, 10000, env)
}

/// Calculate fee based on amount and fee structure
pub fn calculate_fee(
    amount: i128,
    fee_bps: u64,
    min_fee: i128,
    max_fee: i128,
    env: &Env,
) -> Result<i128, SettlementError> {
    let calculated_fee = calculate_percentage(amount, fee_bps, env)?;

    // Apply minimum fee
    let fee_with_min = if calculated_fee < min_fee {
        min_fee
    } else {
        calculated_fee
    };

    // Apply maximum fee
    if max_fee > 0 && fee_with_min > max_fee {
        Ok(max_fee)
    } else {
        Ok(fee_with_min)
    }
}

/// Distribute amount among multiple recipients based on their percentages
pub fn distribute_amount(
    total_amount: i128,
    distributions: &Vec<(u64, i128)>, // (basis_points, min_amount)
    env: &Env,
) -> Result<Vec<i128>, SettlementError> {
    let mut result = Vec::new(env);
    let mut distributed = 0i128;

    // Calculate each distribution
    for (bps, min_amount) in distributions.iter() {
        let amount = calculate_percentage(total_amount, bps, env)?;
        let final_amount = if amount < min_amount {
            min_amount
        } else {
            amount
        };

        result.push_back(final_amount);
        distributed = safe_add(distributed, final_amount, env)?;
    }

    // Ensure we don't exceed total amount
    if distributed > total_amount {
        return Err(SettlementError::Overflow);
    }

    Ok(result)
}

/// Calculate the next bid increment for auctions
pub fn calculate_bid_increment(
    current_price: i128,
    increment_bps: u64,
    env: &Env,
) -> Result<i128, SettlementError> {
    calculate_percentage(current_price, increment_bps, env)
}

/// Validate that percentages add up to 100% (10000 basis points)
pub fn validate_percentage_total(percentages: &Vec<u32>) -> Result<(), SettlementError> {
    let total: u32 = percentages.iter().sum();
    if total != 10000 {
        return Err(SettlementError::InvalidRoyaltyPercentage);
    }
    Ok(())
}

/// Calculate time-weighted average price for Dutch auctions
pub fn calculate_time_weighted_price(
    start_time: u64,
    end_time: u64,
    current_time: u64,
    start_price: i128,
    end_price: i128,
    env: &Env,
) -> Result<i128, SettlementError> {
    if current_time <= start_time {
        return Ok(start_price);
    }

    if current_time >= end_time {
        return Ok(end_price);
    }

    let total_duration = end_time - start_time;
    let elapsed = current_time - start_time;

    if total_duration == 0 {
        return Ok(start_price);
    }

    // Price decreases linearly over time
    let price_diff = safe_sub(start_price, end_price, env)?;
    let weighted_diff = safe_mul(price_diff, elapsed as i128, env)?;
    let time_weighted_diff = safe_div(weighted_diff, total_duration as i128, env)?;

    safe_sub(start_price, time_weighted_diff, env)
}

/// Calculate compound interest (simple implementation)
pub fn calculate_compound_interest(
    principal: i128,
    rate_bps: u64,
    periods: u32,
    env: &Env,
) -> Result<i128, SettlementError> {
    if periods == 0 {
        return Ok(principal);
    }

    let mut result = principal;
    for _ in 0..periods {
        let interest = calculate_percentage(result, rate_bps, env)?;
        result = safe_add(result, interest, env)?;
    }

    Ok(result)
}
