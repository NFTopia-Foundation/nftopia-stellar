use soroban_sdk::{Address, BytesN, contracttype};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // Factory Keys
    FactoryAdmin,
    FactoryFee,
    FeeAsset,
    CollectionCount,
    CollectionAddress(u32),
    CollectionInfo(u32),

    MaxCollectionsPerCreator,
    CreatorCollectionCount(Address),
    /// Collection WASM hashes an admin has approved for `create_collection`
    /// (#737). Presence of the key means allowed; absence means not.
    AllowedWasmHash(BytesN<32>),

    // Collection Keys
    CollectionConfig,
    FactoryAddress,
    TotalSupply,
    TokenMetadata(u32),
    Balance(Address, u32),
    Owner(u32),
    RoyaltyInfo,
    Minter(Address),
    Whitelist(Address),
    IsPaused,
}
