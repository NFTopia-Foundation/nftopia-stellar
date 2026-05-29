use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
pub enum AllowlistKey {
    Token(Address),
    Nft(Address),
}

pub struct AllowlistStore;

impl AllowlistStore {
    /// Check if a token contract is in the allowlist
    pub fn is_token_allowed(env: &Env, contract: &Address) -> bool {
        env.storage()
            .persistent()
            .get(&AllowlistKey::Token(contract.clone()))
            .unwrap_or(false)
    }

    /// Set a token contract's allowlist status
    pub fn set_token_allowed(env: &Env, contract: &Address, allowed: bool) {
        if allowed {
            env.storage()
                .persistent()
                .set(&AllowlistKey::Token(contract.clone()), &true);
        } else {
            env.storage()
                .persistent()
                .remove(&AllowlistKey::Token(contract.clone()));
        }
    }

    /// Check if an NFT contract is in the allowlist
    pub fn is_nft_allowed(env: &Env, contract: &Address) -> bool {
        env.storage()
            .persistent()
            .get(&AllowlistKey::Nft(contract.clone()))
            .unwrap_or(false)
    }

    /// Set an NFT contract's allowlist status
    pub fn set_nft_allowed(env: &Env, contract: &Address, allowed: bool) {
        if allowed {
            env.storage()
                .persistent()
                .set(&AllowlistKey::Nft(contract.clone()), &true);
        } else {
            env.storage()
                .persistent()
                .remove(&AllowlistKey::Nft(contract.clone()));
        }
    }
}
