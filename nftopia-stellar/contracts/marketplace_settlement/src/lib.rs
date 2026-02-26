#![no_std]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::needless_borrow)]

// Module declarations
pub mod atomic_swap;
pub mod auction_engine;
pub mod dispute_resolution;
pub mod error;
pub mod events;
pub mod fee_manager;
pub mod royalty_distributor;
pub mod security;
pub mod settlement_core;
pub mod storage;
pub mod test;
pub mod types;
pub mod utils;

// Re-exports for convenience
pub use settlement_core::MarketplaceSettlement;

// Type aliases for external use
pub type Asset = types::Asset;
pub type AuctionType = types::AuctionType;
pub type FeeConfig = types::FeeConfig;
pub type DisputeConfig = dispute_resolution::DisputeConfig;
pub type AuctionConfig = auction_engine::AuctionConfig;
