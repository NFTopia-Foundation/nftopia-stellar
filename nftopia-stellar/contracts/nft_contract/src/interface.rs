use soroban_sdk::{Address, Bytes, Env, String, Vec};
use crate::types::{TokenAttribute, RoyaltyInfo};
use crate::error::ContractError;

pub trait INft {
    // Core NFT functions
    fn mint(
        env: Env,
        to: Address,
        metadata_uri: String,
        attributes: Vec<TokenAttribute>,
        royalty_override: Option<RoyaltyInfo>,
    ) -> Result<u64, ContractError>;

    fn safe_transfer_from(
        env: Env,
        from: Address,
        to: Address,
        token_id: u64,
        data: Option<Bytes>,
    ) -> Result<(), ContractError>;

    fn burn(env: Env, token_id: u64, confirm: bool) -> Result<(), ContractError>;

    // Royalty functions
    fn get_royalty_info(
        env: Env,
        token_id: u64,
        sale_price: i128,
    ) -> Result<(Address, i128), ContractError>;

    fn set_default_royalty(
        env: Env,
        recipient: Address,
        percentage: u32,
    ) -> Result<(), ContractError>;

    // Batch operations
    fn batch_mint(
        env: Env,
        recipients: Vec<Address>,
        metadata_uris: Vec<String>,
        attributes: Vec<Vec<TokenAttribute>>,
    ) -> Result<Vec<u64>, ContractError>;

    fn batch_transfer(
        env: Env,
        from: Address,
        to: Address,
        token_ids: Vec<u64>,
    ) -> Result<(), ContractError>;
}
