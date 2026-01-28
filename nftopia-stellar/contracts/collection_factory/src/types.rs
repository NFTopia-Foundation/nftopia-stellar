use soroban_sdk::{Address, String, Vec, contracttype};

#[derive(Clone, Debug)]
#[contracttype]
pub struct CollectionConfig {
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub base_uri: String,
    pub max_supply: Option<u32>,
    pub is_public_mint: bool,
    pub royalty_percentage: u32, // Basis points (100 = 1%)
    pub royalty_recipient: Address,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenMetadata {
    pub token_id: u32,
    pub uri: String,
    pub attributes: Vec<(String, String)>,
    pub creator: Address,
    pub created_at: u64,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct CollectionInfo {
    pub address: Address,
    pub creator: Address,
    pub config: CollectionConfig,
    pub created_at: u64,
    pub total_tokens: u32,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct RoyaltyInfo {
    pub recipient: Address,
    pub percentage: u32, // Basis points
}
