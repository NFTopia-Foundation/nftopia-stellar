use crate::error::SettlementError;
use soroban_sdk::{contracttype, Address, Env, Map};

/// Block reason enum for categorizing blocks
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum BlockReason {
    Scam = 0,
    Sanctioned = 1,
    Suspicious = 2,
    Temporary = 3,
    AdminOverride = 4,
}

/// Block record containing information about a blocked address
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct BlockRecord {
    pub blocked_at: u64,
    pub blocked_by: Address,
    pub reason: BlockReason,
    pub expires_at: Option<u64>,
}

/// Storage key for blocked addresses
const BLOCKED_ADDRESSES: &str = "blocked_addresses";

/// Blocklist store for managing blocked addresses
pub struct BlocklistStore;

impl BlocklistStore {
    /// Check if an address is blocked
    pub fn is_blocked(env: &Env, address: &Address) -> bool {
        let blocked_addresses: Map<Address, BlockRecord> = env
            .storage()
            .instance()
            .get(&BLOCKED_ADDRESSES)
            .unwrap_or(Map::new(env));

        if let Some(record) = blocked_addresses.get(address.clone()) {
            // Check if block has expired
            if let Some(expires_at) = record.expires_at {
                let current_time = env.ledger().timestamp();
                if current_time >= expires_at {
                    // Block has expired, remove it inline (no recursive call)
                    let mut addresses = blocked_addresses;
                    addresses.remove(address.clone());
                    env.storage().instance().set(&BLOCKED_ADDRESSES, &addresses);
                    return false;
                }
            }
            return true;
        }
        false
    }

    /// Block an address (admin only)
    pub fn block_address(
        env: &Env,
        admin: &Address,
        address: &Address,
        reason: BlockReason,
        expires_at: Option<u64>,
    ) -> Result<(), SettlementError> {
        let mut blocked_addresses: Map<Address, BlockRecord> = env
            .storage()
            .instance()
            .get(&BLOCKED_ADDRESSES)
            .unwrap_or(Map::new(env));

        let record = BlockRecord {
            blocked_at: env.ledger().timestamp(),
            blocked_by: admin.clone(),
            reason,
            expires_at,
        };

        blocked_addresses.set(address.clone(), record);
        env.storage()
            .instance()
            .set(&BLOCKED_ADDRESSES, &blocked_addresses);

        Ok(())
    }

    /// Unblock an address (admin only)
    pub fn unblock_address(env: &Env, address: &Address) {
        let mut blocked_addresses: Map<Address, BlockRecord> = env
            .storage()
            .instance()
            .get(&BLOCKED_ADDRESSES)
            .unwrap_or(Map::new(env));

        blocked_addresses.remove(address.clone());
        env.storage()
            .instance()
            .set(&BLOCKED_ADDRESSES, &blocked_addresses);
    }

    /// Get block record for an address
    pub fn get_block_record(env: &Env, address: &Address) -> Option<BlockRecord> {
        let blocked_addresses: Map<Address, BlockRecord> = env
            .storage()
            .instance()
            .get(&BLOCKED_ADDRESSES)
            .unwrap_or(Map::new(env));

        blocked_addresses.get(address.clone())
    }

    /// Get all blocked addresses
    pub fn get_blocked_addresses(env: &Env) -> Map<Address, BlockRecord> {
        env.storage()
            .instance()
            .get(&BLOCKED_ADDRESSES)
            .unwrap_or(Map::new(env))
    }

    /// Update block reason (admin only)
    pub fn update_block_reason(
        env: &Env,
        _admin: &Address,
        address: &Address,
        new_reason: BlockReason,
        new_expires_at: Option<u64>,
    ) -> Result<(), SettlementError> {
        let mut blocked_addresses: Map<Address, BlockRecord> = env
            .storage()
            .instance()
            .get(&BLOCKED_ADDRESSES)
            .unwrap_or(Map::new(env));

        if let Some(mut record) = blocked_addresses.get(address.clone()) {
            record.reason = new_reason;
            record.expires_at = new_expires_at;
            blocked_addresses.set(address.clone(), record);
            env.storage()
                .instance()
                .set(&BLOCKED_ADDRESSES, &blocked_addresses);
            Ok(())
        } else {
            Err(SettlementError::NotFound)
        }
    }
}
