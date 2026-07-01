use soroban_sdk::{Address, contracttype};

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
