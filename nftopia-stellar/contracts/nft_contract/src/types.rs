use soroban_sdk::{Address, String, Vec, contracttype};

/// Token attribute for on-chain metadata (OpenSea standard support).
#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenAttribute {
    pub trait_type: String,
    pub value: String,
    /// "number", "date", "boost_percentage", etc.
    pub display_type: Option<String>,
}

/// Royalty information (EIP-2981 equivalent).
#[derive(Clone, Debug)]
#[contracttype]
pub struct RoyaltyInfo {
    pub recipient: Address,
    /// Basis points (0-10000, where 10000 = 100%)
    pub percentage: u32,
}

/// Collection-level configuration.
#[derive(Clone, Debug)]
#[contracttype]
pub struct CollectionConfig {
    pub name: String,
    pub symbol: String,
    pub base_uri: String,
    pub max_supply: Option<u64>,
    /// Optional mint cost in stroops
    pub mint_price: Option<i128>,
    pub is_revealed: bool,
    pub royalty_default: RoyaltyInfo,
    pub metadata_is_frozen: bool,
}

/// Role-based access control.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum Role {
    Owner = 0,
    Admin = 1,
    Minter = 2,
    Burner = 3,
    MetadataUpdater = 4,
}

/// Full token metadata view (for token_metadata query). Equivalent to TokenData in spec.
#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenMetadata {
    pub id: u64,
    pub owner: Address,
    pub approved: Option<Address>,
    pub metadata_uri: String,
    pub created_at: u64,
    pub creator: Address,
    pub royalty_percentage: u32,
    pub royalty_recipient: Address,
    pub attributes: Vec<TokenAttribute>,
    /// For limited editions.
    pub edition_number: Option<u32>,
    /// For limited editions.
    pub total_editions: Option<u32>,
}
