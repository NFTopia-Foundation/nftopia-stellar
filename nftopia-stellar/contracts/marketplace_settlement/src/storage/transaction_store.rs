use crate::error::SettlementError;
use crate::types::{BundleTransaction, SaleTransaction, TradeTransaction};
use soroban_sdk::{symbol_short, Env, Map, Symbol, Vec};

// Storage keys
pub const SALE_TRANSACTIONS: Symbol = symbol_short!("sale_tx");
pub const TRADE_TRANSACTIONS: Symbol = symbol_short!("trade_tx");
pub const BUNDLE_TRANSACTIONS: Symbol = symbol_short!("bndl_tx");
pub const NEXT_SALE_ID: Symbol = symbol_short!("next_sale");
pub const NEXT_TRADE_ID: Symbol = symbol_short!("next_trd");
pub const NEXT_BUNDLE_ID: Symbol = symbol_short!("next_bndl");

/// Storage manager for sale transactions
pub struct SaleTransactionStore;

impl SaleTransactionStore {
    /// Get the next available sale transaction ID
    pub fn next_id(env: &Env) -> u64 {
        let current_id: u64 = env.storage().instance().get(&NEXT_SALE_ID).unwrap_or(1);
        let next_id = current_id + 1;
        env.storage().instance().set(&NEXT_SALE_ID, &next_id);
        current_id
    }

    /// Store a sale transaction
    pub fn put(env: &Env, transaction: &SaleTransaction) -> Result<(), SettlementError> {
        let mut transactions: Map<u64, SaleTransaction> = env
            .storage()
            .instance()
            .get(&SALE_TRANSACTIONS)
            .unwrap_or(Map::new(env));

        transactions.set(transaction.transaction_id, transaction.clone());
        env.storage()
            .instance()
            .set(&SALE_TRANSACTIONS, &transactions);
        Ok(())
    }

    /// Get a sale transaction by ID
    pub fn get(env: &Env, transaction_id: u64) -> Result<SaleTransaction, SettlementError> {
        let transactions: Map<u64, SaleTransaction> = env
            .storage()
            .instance()
            .get(&SALE_TRANSACTIONS)
            .ok_or(SettlementError::TransactionNotFound)?;

        transactions
            .get(transaction_id)
            .ok_or(SettlementError::TransactionNotFound)
    }

    /// Update a sale transaction
    pub fn update(env: &Env, transaction: &SaleTransaction) -> Result<(), SettlementError> {
        Self::put(env, transaction)
    }

    /// Remove a sale transaction
    pub fn remove(env: &Env, transaction_id: u64) -> Result<(), SettlementError> {
        let mut transactions: Map<u64, SaleTransaction> = env
            .storage()
            .instance()
            .get(&SALE_TRANSACTIONS)
            .ok_or(SettlementError::TransactionNotFound)?;

        transactions.remove(transaction_id);
        env.storage()
            .instance()
            .set(&SALE_TRANSACTIONS, &transactions);
        Ok(())
    }

    /// Get all sale transactions (paginated)
    pub fn get_all(env: &Env, offset: u64, limit: u64) -> Vec<SaleTransaction> {
        let transactions: Map<u64, SaleTransaction> = env
            .storage()
            .instance()
            .get(&SALE_TRANSACTIONS)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        let mut count = 0u64;

        for (_, transaction) in transactions.iter() {
            if count >= limit {
                break;
            }
            // Simple offset implementation - in production, you'd want a more efficient approach
            if offset == 0 || count >= offset {
                result.push_back(transaction);
                count += 1;
            }
        }

        result
    }

    /// Get transactions by seller
    pub fn get_by_seller(env: &Env, seller: &soroban_sdk::Address) -> Vec<SaleTransaction> {
        let transactions: Map<u64, SaleTransaction> = env
            .storage()
            .instance()
            .get(&SALE_TRANSACTIONS)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, transaction) in transactions.iter() {
            if &transaction.seller == seller {
                result.push_back(transaction);
            }
        }
        result
    }

    /// Get transactions by buyer
    pub fn get_by_buyer(env: &Env, buyer: &soroban_sdk::Address) -> Vec<SaleTransaction> {
        let transactions: Map<u64, SaleTransaction> = env
            .storage()
            .instance()
            .get(&SALE_TRANSACTIONS)
            .unwrap_or(Map::new(env));

        let mut result = Vec::new(env);
        for (_, transaction) in transactions.iter() {
            if let Some(buyer_addr) = &transaction.buyer {
                if buyer_addr == buyer {
                    result.push_back(transaction);
                }
            }
        }
        result
    }
}

/// Storage manager for trade transactions
pub struct TradeTransactionStore;

impl TradeTransactionStore {
    /// Get the next available trade transaction ID
    pub fn next_id(env: &Env) -> u64 {
        let current_id: u64 = env.storage().instance().get(&NEXT_TRADE_ID).unwrap_or(1);
        let next_id = current_id + 1;
        env.storage().instance().set(&NEXT_TRADE_ID, &next_id);
        current_id
    }

    /// Store a trade transaction
    pub fn put(env: &Env, transaction: &TradeTransaction) -> Result<(), SettlementError> {
        let mut transactions: Map<u64, TradeTransaction> = env
            .storage()
            .instance()
            .get(&TRADE_TRANSACTIONS)
            .unwrap_or(Map::new(env));

        transactions.set(transaction.trade_id, transaction.clone());
        env.storage()
            .instance()
            .set(&TRADE_TRANSACTIONS, &transactions);
        Ok(())
    }

    /// Get a trade transaction by ID
    pub fn get(env: &Env, trade_id: u64) -> Result<TradeTransaction, SettlementError> {
        let transactions: Map<u64, TradeTransaction> = env
            .storage()
            .instance()
            .get(&TRADE_TRANSACTIONS)
            .ok_or(SettlementError::TransactionNotFound)?;

        transactions
            .get(trade_id)
            .ok_or(SettlementError::TransactionNotFound)
    }

    /// Update a trade transaction
    pub fn update(env: &Env, transaction: &TradeTransaction) -> Result<(), SettlementError> {
        Self::put(env, transaction)
    }
}

/// Storage manager for bundle transactions
pub struct BundleTransactionStore;

impl BundleTransactionStore {
    /// Get the next available bundle transaction ID
    pub fn next_id(env: &Env) -> u64 {
        let current_id: u64 = env.storage().instance().get(&NEXT_BUNDLE_ID).unwrap_or(1);
        let next_id = current_id + 1;
        env.storage().instance().set(&NEXT_BUNDLE_ID, &next_id);
        current_id
    }

    /// Store a bundle transaction
    pub fn put(env: &Env, transaction: &BundleTransaction) -> Result<(), SettlementError> {
        let mut transactions: Map<u64, BundleTransaction> = env
            .storage()
            .instance()
            .get(&BUNDLE_TRANSACTIONS)
            .unwrap_or(Map::new(env));

        transactions.set(transaction.bundle_id, transaction.clone());
        env.storage()
            .instance()
            .set(&BUNDLE_TRANSACTIONS, &transactions);
        Ok(())
    }

    /// Get a bundle transaction by ID
    pub fn get(env: &Env, bundle_id: u64) -> Result<BundleTransaction, SettlementError> {
        let transactions: Map<u64, BundleTransaction> = env
            .storage()
            .instance()
            .get(&BUNDLE_TRANSACTIONS)
            .ok_or(SettlementError::TransactionNotFound)?;

        transactions
            .get(bundle_id)
            .ok_or(SettlementError::TransactionNotFound)
    }

    /// Update a bundle transaction
    pub fn update(env: &Env, transaction: &BundleTransaction) -> Result<(), SettlementError> {
        Self::put(env, transaction)
    }
}
