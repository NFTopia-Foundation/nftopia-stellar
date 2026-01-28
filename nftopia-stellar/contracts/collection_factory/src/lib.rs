#![no_std]
pub mod collection;
pub mod error;
pub mod events;
pub mod factory;
pub mod storage;
pub mod types;

pub use crate::collection::NftCollection;
pub use crate::factory::CollectionFactory;

#[cfg(test)]
mod test;
