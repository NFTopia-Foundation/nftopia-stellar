//! Contract interface identifiers (ERC-165 equivalent for Stellar).
//! Interface IDs can be used by marketplaces/wallets to detect contract capabilities.

/// Interface ID for core NFT (ERC-721 equivalent).
pub const INTERFACE_ID_NFT: u32 = 0x80ac58cd;

/// Interface ID for royalty info (EIP-2981 equivalent).
pub const INTERFACE_ID_ROYALTY: u32 = 0x2a55205a;

/// Interface ID for metadata.
pub const INTERFACE_ID_METADATA: u32 = 0x5b5e139f;
