use crate::error::TransactionError;
use crate::types::{SignatureRecord, Transaction};
use soroban_sdk::{Address, Bytes, Env};

pub fn append_signature(env: &Env, tx: &mut Transaction, signer: Address, signature: Bytes) {
    tx.signatures.push_back(SignatureRecord {
        signer,
        signature,
        obtained_at: env.ledger().timestamp(),
    });
}

pub fn has_any_signature(tx: &Transaction) -> Result<bool, TransactionError> {
    if tx.signatures.is_empty() {
        return Err(TransactionError::SignatureMissing);
    }
    Ok(true)
}
