use crate::error::SettlementError;
use crate::storage::allowlist_store::AllowlistStore;
use crate::types::Asset;
use soroban_sdk::{token, Address, Bytes, Env, IntoVal, Symbol, Vec};

/// Create a native XLM asset
pub fn native_asset() -> Asset {
    // This function is primarily for testing - in production,
    // native XLM assets are handled differently by the Soroban runtime
    // Return a dummy asset for now
    panic!("Native asset handling not implemented in this test version")
}

/// Validate that an asset is supported
pub fn validate_asset(
    asset: &Asset,
    supported_assets: &Vec<Asset>,
    _env: &Env,
) -> Result<(), SettlementError> {
    if supported_assets.is_empty() {
        return Err(SettlementError::AssetNotSupported);
    }
    for i in 0..supported_assets.len() {
        if assets_equal(asset, &supported_assets.get(i).unwrap()) {
            return Ok(());
        }
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
pub fn is_valid_token_contract(address: &Address, env: &Env) -> bool {
    AllowlistStore::is_token_allowed(env, address)
}

/// Get token balance for an account
pub fn get_token_balance(
    token_contract: &Address,
    account: &Address,
    env: &Env,
) -> Result<i128, SettlementError> {
    let client = token::Client::new(env, token_contract);
    Ok(client.balance(account))
}

/// Transfer tokens between accounts
pub fn transfer_tokens(
    token_contract: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
    env: &Env,
) -> Result<(), SettlementError> {
    let client = token::Client::new(env, token_contract);
    client.transfer(from, to, &amount);
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
    if !AllowlistStore::is_nft_allowed(env, nft_contract) {
        return Err(SettlementError::InvalidState);
    }
    Ok(())
}

/// Check NFT ownership
pub fn check_nft_ownership(
    nft_contract: &Address,
    token_id: u64,
    owner: &Address,
    env: &Env,
) -> Result<bool, SettlementError> {
    let current_owner: Address = env.invoke_contract(
        nft_contract,
        &Symbol::new(env, "owner_of"),
        soroban_sdk::vec![env, token_id.into_val(env)],
    );
    Ok(current_owner == *owner)
}

/// Transfer NFT
pub fn transfer_nft(
    nft_contract: &Address,
    from: &Address,
    to: &Address,
    token_id: u64,
    env: &Env,
) -> Result<(), SettlementError> {
    env.invoke_contract::<()>(
        nft_contract,
        &Symbol::new(env, "transfer"),
        soroban_sdk::vec![
            env,
            env.current_contract_address().into_val(env),
            from.into_val(env),
            to.into_val(env),
            token_id.into_val(env),
        ],
    );
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
