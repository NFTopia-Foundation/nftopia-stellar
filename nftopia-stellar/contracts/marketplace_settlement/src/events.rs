use soroban_sdk::{contracttype, symbol_short, Env, Address, Vec, Bytes};
use crate::types::*;

// Sale Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleCreatedEvent {
    pub transaction_id: u64,
    pub seller: Address,
    pub nft_address: Address,
    pub token_id: u64,
    pub price: i128,
    pub currency: Asset,
    pub expires_at: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleExecutedEvent {
    pub transaction_id: u64,
    pub seller: Address,
    pub buyer: Address,
    pub nft_address: Address,
    pub token_id: u64,
    pub price: i128,
    pub platform_fee: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleCancelledEvent {
    pub transaction_id: u64,
    pub cancelled_by: Address,
    pub reason: Bytes,
    pub timestamp: u64,
}

// Auction Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionCreatedEvent {
    pub auction_id: u64,
    pub seller: Address,
    pub nft_address: Address,
    pub token_id: u64,
    pub starting_price: i128,
    pub reserve_price: i128,
    pub currency: Asset,
    pub end_time: u64,
    pub auction_type: AuctionType,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BidPlacedEvent {
    pub auction_id: u64,
    pub bidder: Address,
    pub amount: i128,
    pub is_committed: bool,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BidRevealedEvent {
    pub auction_id: u64,
    pub bidder: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionEndedEvent {
    pub auction_id: u64,
    pub winner: Option<Address>,
    pub final_price: i128,
    pub reason: Bytes, // "ended", "cancelled", "reserve_not_met"
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionExtendedEvent {
    pub auction_id: u64,
    pub new_end_time: u64,
    pub extension_reason: Bytes,
    pub timestamp: u64,
}

// Trade Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeCreatedEvent {
    pub trade_id: u64,
    pub initiator: Address,
    pub expires_at: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeAcceptedEvent {
    pub trade_id: u64,
    pub acceptor: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeExecutedEvent {
    pub trade_id: u64,
    pub timestamp: u64,
}

// Bundle Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BundleCreatedEvent {
    pub bundle_id: u64,
    pub seller: Address,
    pub item_count: u64,
    pub total_price: i128,
    pub currency: Asset,
    pub expires_at: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BundleExecutedEvent {
    pub bundle_id: u64,
    pub buyer: Address,
    pub timestamp: u64,
}

// Royalty and Fee Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltiesDistributedEvent {
    pub transaction_id: u64,
    pub nft_address: Address,
    pub token_id: u64,
    pub creator: Address,
    pub creator_amount: i128,
    pub seller_amount: i128,
    pub platform_amount: i128,
    pub total_amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformFeesCollectedEvent {
    pub amount: i128,
    pub currency: Asset,
    pub collector: Address,
    pub timestamp: u64,
}

// Dispute Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeCreatedEvent {
    pub dispute_id: u64,
    pub transaction_id: u64,
    pub auction_id: Option<u64>,
    pub initiator: Address,
    pub reason: Bytes,
    pub arbitrators: Vec<Address>,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeVoteEvent {
    pub dispute_id: u64,
    pub arbitrator: Address,
    pub vote: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolvedEvent {
    pub dispute_id: u64,
    pub resolution: u64,
    pub winning_votes: u64,
    pub total_votes: u64,
    pub timestamp: u64,
}

// Security Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReentrancyDetectedEvent {
    pub caller: Address,
    pub function: Bytes,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FrontRunningDetectedEvent {
    pub suspicious_address: Address,
    pub pattern: Bytes,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyWithdrawalEvent {
    pub transaction_id: u64,
    pub reason: Bytes,
    pub admin: Address,
    pub timestamp: u64,
}

// Configuration Events
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfigUpdatedEvent {
    pub new_config: FeeConfig,
    pub updated_by: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminConfigUpdatedEvent {
    pub updated_fields: Bytes,
    pub updated_by: Address,
    pub timestamp: u64,
}

// Event emission functions
#[allow(deprecated)]
pub fn emit_sale_created(env: &Env, event: SaleCreatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("sale_crtd")), event);
}

#[allow(deprecated)]
pub fn emit_sale_executed(env: &Env, event: SaleExecutedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("sale_exec")), event);
}

#[allow(deprecated)]
pub fn emit_sale_cancelled(env: &Env, event: SaleCancelledEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("sale_canc")), event);
}

#[allow(deprecated)]
pub fn emit_auction_created(env: &Env, event: AuctionCreatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("auc_crtd")), event);
}

#[allow(deprecated)]
pub fn emit_bid_placed(env: &Env, event: BidPlacedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("bid_plcd")), event);
}

#[allow(deprecated)]
pub fn emit_bid_revealed(env: &Env, event: BidRevealedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("bid_revl")), event);
}

#[allow(deprecated)]
pub fn emit_auction_ended(env: &Env, event: AuctionEndedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("auc_ended")), event);
}

#[allow(deprecated)]
pub fn emit_auction_extended(env: &Env, event: AuctionExtendedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("auc_extd")), event);
}

#[allow(deprecated)]
pub fn emit_trade_created(env: &Env, event: TradeCreatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("trd_crtd")), event);
}

#[allow(deprecated)]
pub fn emit_trade_accepted(env: &Env, event: TradeAcceptedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("trd_acc")), event);
}

#[allow(deprecated)]
pub fn emit_trade_executed(env: &Env, event: TradeExecutedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("trd_exec")), event);
}

#[allow(deprecated)]
pub fn emit_bundle_created(env: &Env, event: BundleCreatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("bndl_crtd")), event);
}

#[allow(deprecated)]
pub fn emit_bundle_executed(env: &Env, event: BundleExecutedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("bndl_exec")), event);
}

#[allow(deprecated)]
pub fn emit_royalties_distributed(env: &Env, event: RoyaltiesDistributedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("roy_dist")), event);
}

#[allow(deprecated)]
pub fn emit_platform_fees_collected(env: &Env, event: PlatformFeesCollectedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("fee_coll")), event);
}

#[allow(deprecated)]
pub fn emit_dispute_created(env: &Env, event: DisputeCreatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("dsp_crtd")), event);
}

#[allow(deprecated)]
pub fn emit_dispute_vote(env: &Env, event: DisputeVoteEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("dsp_vote")), event);
}

#[allow(deprecated)]
pub fn emit_dispute_resolved(env: &Env, event: DisputeResolvedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("dsp_rslv")), event);
}

#[allow(deprecated)]
pub fn emit_reentrancy_detected(env: &Env, event: ReentrancyDetectedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("reentr")), event);
}

#[allow(deprecated)]
pub fn emit_front_running_detected(env: &Env, event: FrontRunningDetectedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("frontrun")), event);
}

#[allow(deprecated)]
pub fn emit_emergency_withdrawal(env: &Env, event: EmergencyWithdrawalEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("emerg_wd")), event);
}

#[allow(deprecated)]
pub fn emit_fee_config_updated(env: &Env, event: FeeConfigUpdatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("fee_upd")), event);
}

#[allow(deprecated)]
pub fn emit_admin_config_updated(env: &Env, event: AdminConfigUpdatedEvent) {
    env.events().publish(("MarketplaceSettlement", symbol_short!("admin_upd")), event);
}