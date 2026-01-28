use soroban_sdk::Env;
use crate::error::SettlementError;

/// Get current timestamp from the environment
pub fn current_timestamp(env: &Env) -> u64 {
    env.ledger().timestamp()
}

/// Check if a timestamp has expired
pub fn is_expired(timestamp: u64, env: &Env) -> bool {
    current_timestamp(env) >= timestamp
}

/// Check if a timestamp is in the future
pub fn is_future(timestamp: u64, env: &Env) -> bool {
    timestamp > current_timestamp(env)
}

/// Calculate time difference in seconds
pub fn time_diff_seconds(future: u64, past: u64) -> Result<u64, SettlementError> {
    if future < past {
        return Err(SettlementError::InvalidAmount);
    }
    Ok(future - past)
}

/// Check if current time is within a time window
pub fn is_within_time_window(start: u64, end: u64, env: &Env) -> bool {
    let now = current_timestamp(env);
    now >= start && now <= end
}

/// Calculate expiration timestamp from duration
pub fn calculate_expiration(start_time: u64, duration_seconds: u64) -> Result<u64, SettlementError> {
    start_time.checked_add(duration_seconds)
        .ok_or(SettlementError::Overflow)
}

/// Extend a deadline by additional seconds
pub fn extend_deadline(current_deadline: u64, extension_seconds: u64) -> Result<u64, SettlementError> {
    current_deadline.checked_add(extension_seconds)
        .ok_or(SettlementError::Overflow)
}

/// Check if enough time has passed since a reference timestamp
pub fn has_time_elapsed(reference: u64, required_seconds: u64, env: &Env) -> bool {
    let elapsed = time_diff_seconds(current_timestamp(env), reference).unwrap_or(0);
    elapsed >= required_seconds
}

/// Calculate remaining time until expiration
pub fn remaining_time(expires_at: u64, env: &Env) -> u64 {
    let now = current_timestamp(env);
    if now >= expires_at {
        0
    } else {
        expires_at - now
    }
}

/// Validate auction timing parameters
pub fn validate_auction_timing(
    start_time: u64,
    end_time: u64,
    extension_window: u64,
    env: &Env,
) -> Result<(), SettlementError> {
    let now = current_timestamp(env);

    // Start time must be in the future or now
    if start_time < now {
        return Err(SettlementError::InvalidAmount);
    }

    // End time must be after start time
    if end_time <= start_time {
        return Err(SettlementError::InvalidAmount);
    }

    // Extension window should be reasonable (not too long)
    if extension_window > 86400 * 7 { // Max 7 days extension
        return Err(SettlementError::InvalidAmount);
    }

    Ok(())
}

/// Validate transaction timing parameters
pub fn validate_transaction_timing(
    created_at: u64,
    expires_at: u64,
    max_duration: u64,
    env: &Env,
) -> Result<(), SettlementError> {
    let now = current_timestamp(env);

    // Creation time should be now or in the past
    if created_at > now {
        return Err(SettlementError::InvalidAmount);
    }

    // Expiration should be in the future
    if expires_at <= now {
        return Err(SettlementError::Expired);
    }

    // Duration should not exceed maximum
    let duration = expires_at - created_at;
    if duration > max_duration {
        return Err(SettlementError::InvalidAmount);
    }

    Ok(())
}

/// Check if auction should be extended due to last-minute bidding
pub fn should_extend_auction(
    end_time: u64,
    last_bid_time: u64,
    extension_window: u64,
    env: &Env,
) -> bool {
    let now = current_timestamp(env);
    let time_since_last_bid = now - last_bid_time;

    // If bid was placed within extension window of end time, extend
    if end_time > now {
        let time_to_end = end_time - now;
        time_to_end <= extension_window
    } else {
        // Auction already ended, check if last bid was very recent
        time_since_last_bid <= extension_window
    }
}

/// Calculate new end time with extension
pub fn calculate_extended_end_time(
    current_end_time: u64,
    extension_window: u64,
    env: &Env,
) -> u64 {
    let now = current_timestamp(env);
    let proposed_end = now + extension_window;

    // Don't shorten the auction, only extend it
    if proposed_end > current_end_time {
        proposed_end
    } else {
        current_end_time
    }
}