#![no_std]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::cast_sign_loss)]
#![allow(clippy::cast_lossless)]
pub mod collection;
pub mod error;
pub mod events;
pub mod factory;
pub mod storage;
pub mod types;
pub mod version;

pub use crate::collection::NftCollection;
pub use crate::factory::CollectionFactory;

#[cfg(test)]
mod test;
