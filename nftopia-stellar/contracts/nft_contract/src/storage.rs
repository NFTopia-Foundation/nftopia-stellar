use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    // Role-based Access Control
    Admin,
    Minter(Address),
    Burner(Address),
    MetadataUpdater(Address),

    // Collection Level Storage
    CollectionConfig,
    RoyaltyDefault,
    TotalSupply,    // The sequence for token IDs
    
    // Token Level Storage
    Token(u64),     // Maps token ID to TokenData
    TokenURI(u64),  // Maps token ID to its URI if overridden

    // Approvals
    Approved(u64),                 // Maps token ID to an approved Address
    Operator(Address, Address),    // Maps (Owner, Operator) to bool

    // Balances
    Balance(Address),              // Maps owner to token count
}
