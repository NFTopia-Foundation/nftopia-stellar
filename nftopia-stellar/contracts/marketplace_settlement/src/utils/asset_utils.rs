use soroban_sdk::{Address, Env, Symbol, Vec, Bytes};
use crate::error::SettlementError;
use crate::types::Asset;

/// Create a native XLM asset
pub fn native_asset() -> Asset {
    // This function is primarily for testing - in production,
    // native XLM assets are handled differently by the Soroban runtime
    // Return a dummy asset for now
    panic!("Native asset handling not implemented in this test version")
}

/// Validate that an asset is supported
pub fn validate_asset(asset: &Asset, supported_assets: &Vec<Asset>, _env: &Env) -> Result<(), SettlementError> {
    // Check if asset is in the supported list
    for supported in supported_assets.iter() {
        if supported.contract == asset.contract {
            return Ok(());
        }
    }

    // Check if it's native XLM (which is always supported)
    if asset.contract == native_asset().contract {
        return Ok(());
    }

    Err(SettlementError::AssetNotSupported)
}

/// Check if two assets are the same
pub fn assets_equal(a: &Asset, b: &Asset) -> bool {
    a.contract == b.contract
}

/// Get asset symbol for display purposes
pub fn get_asset_symbol(asset: &Asset, _env: &Env) -> Symbol {
    asset.symbol.clone()
}

/// Validate payment amount for an asset
pub fn validate_payment_amount(amount: i128, min_amount: i128) -> Result<(), SettlementError> {
    if amount <= 0 {
        return Err(SettlementError::InvalidAmount);
    }

    if amount < min_amount {
        return Err(SettlementError::InsufficientPayment);
    }

    Ok(())
}

/// Calculate asset transfer amount after fees
pub fn calculate_transfer_amount(
    total_amount: i128,
    fee_amount: i128,
    env: &Env,
) -> Result<i128, SettlementError> {
    use crate::utils::math_utils::safe_sub;
    safe_sub(total_amount, fee_amount, env)
}

/// Check if an address is a valid token contract
pub fn is_valid_token_contract(_address: &Address, _env: &Env) -> bool {
    // For now, assume all addresses are valid
    true
}

/// Get token balance for an account
pub fn get_token_balance(
    _token_contract: &Address,
    _account: &Address,
    _env: &Env,
) -> Result<i128, SettlementError> {
    // For now, return a placeholder
    Err(SettlementError::NotFound) // Placeholder
}

/// Transfer tokens between accounts
pub fn transfer_tokens(
    _token_contract: &Address,
    _from: &Address,
    _to: &Address,
    _amount: i128,
    _env: &Env,
) -> Result<(), SettlementError> {
    // For now, return success
    Ok(())
}

/// Approve token spending
pub fn approve_token_spending(
    _token_contract: &Address,
    _owner: &Address,
    _spender: &Address,
    _amount: i128,
    _env: &Env,
) -> Result<(), SettlementError> {
    Ok(())
}

/// Check token allowance
pub fn check_token_allowance(
    _token_contract: &Address,
    _owner: &Address,
    _spender: &Address,
    _env: &Env,
) -> Result<i128, SettlementError> {
    Ok(0) // Placeholder
}

/// Get token decimals
pub fn get_token_decimals(_token_contract: &Address, _env: &Env) -> Result<u32, SettlementError> {
    Ok(7) // Default for Stellar assets
}

/// Format amount with proper decimals
pub fn format_amount_with_decimals(_amount: i128, _decimals: u64) -> Bytes {
    Bytes::new(&Env::default()) // Placeholder
}

/// Validate that an NFT contract supports the required interface
pub fn validate_nft_contract(nft_contract: &Address, env: &Env) -> Result<(), SettlementError> {
    if !is_valid_token_contract(nft_contract, env) {
        return Err(SettlementError::InvalidState);
    }
    Ok(())
}

/// Check NFT ownership
pub fn check_nft_ownership(
    _nft_contract: &Address,
    _token_id: u64,
    _owner: &Address,
    _env: &Env,
) -> Result<bool, SettlementError> {
    Ok(true) // Placeholder
}

/// Transfer NFT
pub fn transfer_nft(
    _nft_contract: &Address,
    _from: &Address,
    _to: &Address,
    _token_id: u64,
    _env: &Env,
) -> Result<(), SettlementError> {
    Ok(())
}

/// Get NFT metadata URI
pub fn get_nft_metadata_uri(
    _nft_contract: &Address,
    _token_id: u64,
    env: &Env,
) -> Result<Bytes, SettlementError> {
    Ok(Bytes::new(env)) // Placeholder
}