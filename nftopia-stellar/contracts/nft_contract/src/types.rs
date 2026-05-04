use soroban_sdk::{Address, String, Vec, contracttype};

#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenAttribute {
    pub trait_type: String,
    pub value: String,
    pub display_type: Option<String>,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenData {
    pub id: u64,
    pub owner: Address,
    pub metadata_uri: String,
    pub created_at: u64,
    pub creator: Address,
    pub royalty_percentage: u32,
    pub royalty_recipient: Address,
    pub attributes: Vec<TokenAttribute>,
    pub edition_number: Option<u32>,
    pub total_editions: Option<u32>,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct RoyaltyInfo {
    pub recipient: Address,
    pub percentage: u32, // Basis points (0–10000)
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct CollectionConfig {
    pub name: String,
    pub symbol: String,
    pub base_uri: String,
    pub max_supply: Option<u64>,
    pub mint_price: Option<i128>,
    pub is_revealed: bool,
    pub metadata_is_frozen: bool,
}

// Role discriminants stored in DataKey::Role(addr, discriminant)
pub mod role {
    pub const OWNER: u32 = 0;
    pub const ADMIN: u32 = 1;
    pub const MINTER: u32 = 2;
    pub const BURNER: u32 = 3;
    pub const METADATA_UPDATER: u32 = 4;
}
