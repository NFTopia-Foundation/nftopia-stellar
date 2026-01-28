#![no_std]

// Module declarations
pub mod error;
pub mod types;
pub mod utils;
pub mod storage;
pub mod atomic_swap;
pub mod auction_engine;
pub mod royalty_distributor;
pub mod fee_manager;
pub mod dispute_resolution;
pub mod security;
pub mod events;
pub mod settlement_core;
pub mod test;

// Re-exports for convenience
pub use settlement_core::MarketplaceSettlement;

// Type aliases for external use
pub type Asset = types::Asset;
pub type AuctionType = types::AuctionType;
pub type FeeConfig = types::FeeConfig;
pub type DisputeConfig = dispute_resolution::DisputeConfig;
pub type AuctionConfig = auction_engine::AuctionConfig;
