use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotAuthorized = 1,
    NotOwner = 2,
    TokenNotFound = 3,
    NotPermitted = 4,
}
