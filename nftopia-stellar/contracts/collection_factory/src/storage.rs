use soroban_sdk::{Address, contracttype};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // Factory Keys
    FactoryAdmin,
    FactoryFee,
    CollectionCount,
    CollectionAddress(u32),
    CollectionInfo(u32),

    // Collection Keys
    CollectionConfig,
    TotalSupply,
    TokenMetadata(u32),
    Balance(Address, u32),
    Owner(u32),
    RoyaltyInfo,
    Minter(Address),
    Whitelist(Address),
    IsPaused,
}
