#![no_std]
#![allow(clippy::too_many_arguments)]

pub mod dependency_resolver;
pub mod error;
pub mod events;
pub mod execution_engine;
pub mod gas_optimizer;
pub mod operation_manager;
pub mod recovery_system;
pub mod security;
pub mod signature_manager;
pub mod state_machine;
pub mod storage;
pub mod transaction_core;
pub mod tx_storage;
pub mod types;
pub mod utils;

pub use error::TransactionError;
pub use transaction_core::TransactionContract;
pub use types::*;

#[cfg(test)]
mod test;
