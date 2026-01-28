use soroban_sdk::{contracttype, Address, Vec, Map, Symbol, Bytes};

// Transaction state enum
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum TransactionState {
    Pending = 0,
    Funded = 1,
    Executed = 2,
    Cancelled = 3,
    Disputed = 4,
    Resolved = 5,
}

// Asset type for multi-asset support
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Asset {
    pub contract: Address,
    pub symbol: Symbol,
}

// Sale transaction structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleTransaction {
    pub transaction_id: u64,
    pub seller: Address,
    pub buyer: Option<Address>,
    pub nft_address: Address,
    pub token_id: u64,
    pub price: i128,
    pub currency: Asset,
    pub state: TransactionState,
    pub created_at: u64,
    pub expires_at: u64,
    pub escrow_address: Address,
    pub royalty_info: RoyaltyDistribution,
    pub platform_fee: i128,
}

// Auction transaction structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionTransaction {
    pub auction_id: u64,
    pub seller: Address,
    pub nft_address: Address,
    pub token_id: u64,
    pub starting_price: i128,
    pub reserve_price: i128,
    pub highest_bid: i128,
    pub highest_bidder: Option<Address>,
    pub bid_increment: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub state: TransactionState,
    pub bids: Vec<Bid>,
    pub extension_window: u64, // Time extension for last-minute bids
    pub currency: Asset,
    pub royalty_info: RoyaltyDistribution,
    pub platform_fee: i128,
}

// Bid structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bid {
    pub bidder: Address,
    pub amount: i128,
    pub placed_at: u64,
    pub is_committed: bool, // For commit-reveal schemes
    pub commitment_hash: Option<Bytes>,
}

// Royalty distribution structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltyDistribution {
    pub creator_address: Address,
    pub creator_percentage: u64, // Basis points (10000 = 100%)
    pub seller_percentage: u64, // Basis points
    pub platform_percentage: u64, // Basis points
    pub total_amount: i128,
    pub amounts: Map<Address, i128>, // Final amounts for each party
}

// Dispute information structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub dispute_id: u64,
    pub transaction_id: u64,
    pub auction_id: Option<u64>,
    pub initiator: Address,
    pub reason: Bytes, // String stored as bytes for efficiency
    pub evidence_uri: Option<Bytes>,
    pub arbitrators: Vec<Address>,
    pub votes: Map<Address, u64>, // 1 = for initiator, 0 = against
    pub required_votes: u64,
    pub created_at: u64,
    pub resolved_at: u64, // 0 = not resolved
    pub resolution: u64, // 0 = not resolved, 1 = refund buyer, 2 = release to seller, 3 = split funds, 4 = cancel transaction
}

// Fee configuration structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    pub platform_fee_bps: u64, // Basis points
    pub minimum_fee: i128,
    pub maximum_fee: i128,
    pub fee_recipient: Address,
    pub dynamic_fee_enabled: bool,
    pub volume_discounts: Vec<VolumeTier>,
    pub vip_exemptions: Vec<Address>,
}

// Volume tier for dynamic fees
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VolumeTier {
    pub min_volume: i128,
    pub fee_discount_bps: u64,
}

// Trade transaction for NFT-for-NFT swaps
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeTransaction {
    pub trade_id: u64,
    pub initiator: Address,
    pub counterparty: Option<Address>,
    pub initiator_nfts: Vec<NFTItem>,
    pub counterparty_nfts: Vec<NFTItem>,
    pub state: TransactionState,
    pub created_at: u64,
    pub expires_at: u64,
    pub platform_fee: i128,
}

// NFT item structure for bundles and trades
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NFTItem {
    pub nft_address: Address,
    pub token_id: u64,
    pub royalty_info: RoyaltyDistribution,
}

// Bundle transaction for multi-item sales
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BundleTransaction {
    pub bundle_id: u64,
    pub seller: Address,
    pub buyer: Option<Address>,
    pub items: Vec<NFTItem>,
    pub total_price: i128,
    pub currency: Asset,
    pub state: TransactionState,
    pub created_at: u64,
    pub expires_at: u64,
    pub platform_fee: i128,
}

// Execution result for transaction completions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecutionResult {
    pub transaction_id: u64,
    pub success: bool,
    pub transferred_nft: bool,
    pub transferred_payment: bool,
    pub distributed_royalties: bool,
    pub collected_platform_fee: bool,
    pub timestamp: u64,
}

// Distribution result for royalty and fee distribution
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DistributionResult {
    pub transaction_id: u64,
    pub total_amount: i128,
    pub creator_amount: i128,
    pub seller_amount: i128,
    pub platform_amount: i128,
    pub distribution_success: bool,
    pub timestamp: u64,
}

// Auction types
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum AuctionType {
    English = 0, // Price increases with bidding
    Dutch = 1,   // Price decreases over time
}

// Dutch auction specific data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DutchAuctionData {
    pub starting_price: i128,
    pub ending_price: i128,
    pub price_decrement: u64, // Amount to decrease per time unit
    pub time_unit: u64,        // Time unit in seconds for decrement
    pub current_price: i128,
    pub last_price_update: u64,
}

// Admin configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminConfig {
    pub admin: Address,
    pub emergency_withdrawal_enabled: bool,
    pub max_transaction_duration: u64,
    pub max_auction_duration: u64,
    pub min_bid_increment_bps: u64, // Minimum bid increment in basis points
    pub max_royalty_percentage: u64, // Maximum royalty percentage
    pub dispute_cooling_period: u64, // Cooling period before dispute resolution
    pub arbitration_quorum: u64, // Required votes for arbitration
}