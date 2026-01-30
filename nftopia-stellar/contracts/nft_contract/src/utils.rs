use crate::error::ContractError;

/// Basis points denominator (10000 = 100%).
pub const BPS_DENOMINATOR: u32 = 10_000;

/// Maximum royalty in basis points (100%).
pub const MAX_ROYALTY_BPS: u32 = 10_000;

/// Validates royalty percentage (0-10000 basis points).
#[inline]
pub fn validate_royalty_bps(percentage: u32) -> Result<(), ContractError> {
    if percentage > MAX_ROYALTY_BPS {
        return Err(ContractError::InvalidRoyalty);
    }
    Ok(())
}

/// Calculates royalty amount from sale price.
/// Returns (royalty_amount, seller_amount) to avoid precision loss.
#[inline]
pub fn calculate_royalty(sale_price: i128, royalty_bps: u32) -> (i128, i128) {
    if royalty_bps == 0 {
        return (0, sale_price);
    }
    let royalty = sale_price
        .checked_mul(royalty_bps as i128)
        .and_then(|v| v.checked_div(BPS_DENOMINATOR as i128))
        .unwrap_or(0);
    let seller_amount = sale_price.saturating_sub(royalty);
    (royalty, seller_amount)
}
