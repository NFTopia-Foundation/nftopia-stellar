use soroban_sdk::Address;
use soroban_sdk::contracttype;

/// Storage keys for the NFT contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Whether the contract has been initialized.
    Initialized,
    /// Collection-level configuration.
    CollectionConfig,
    /// Default royalty info (recipient, percentage).
    DefaultRoyalty,
    /// Total number of tokens ever minted (also next token id if sequential).
    NextTokenId,
    /// Total supply (number of tokens in existence).
    TotalSupply,
    /// Max supply cap (optional).
    MaxSupply,
    /// Owner of a specific token.
    Owner(u64),
    /// Approved address for a specific token.
    Approved(u64),
    /// Balance of an address (number of tokens owned).
    Balance(Address),
    /// Operator approval: owner -> operator -> allowed.
    OperatorApproval(Address, Address),
    /// Token metadata URI.
    TokenUri(u64),
    /// Token creation timestamp.
    TokenCreatedAt(u64),
    /// Token creator.
    TokenCreator(u64),
    /// Token-level royalty percentage (basis points). Overrides default if set.
    TokenRoyaltyBps(u64),
    /// Token-level royalty recipient. Overrides default if set.
    TokenRoyaltyRecipient(u64),
    /// Token attributes (on-chain metadata).
    TokenAttributes(u64),
    /// Edition number for limited editions.
    TokenEditionNumber(u64),
    /// Total editions for limited editions.
    TokenTotalEditions(u64),
    /// Base URI for the collection.
    BaseUri,
    /// Whether metadata is frozen (immutable).
    MetadataFrozen,
    /// Contract paused state.
    Paused,
    /// Contract owner (admin owner).
    OwnerRole,
    /// Admin addresses.
    Admin(Address),
    /// Minter role.
    Minter(Address),
    /// Burner role.
    Burner(Address),
    /// Metadata updater role.
    MetadataUpdater(Address),
    /// Whitelist for minting.
    Whitelist(Address),
    /// When true, only whitelisted addresses can mint.
    WhitelistOnlyMint,
    /// Reentrancy lock.
    ReentrancyLock,
}
