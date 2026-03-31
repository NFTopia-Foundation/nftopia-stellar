use crate::types::{RecoveryResult, RecoveryStrategy, Transaction, TransactionState};
use soroban_sdk::{Env, String};

pub fn apply_recovery(
    env: &Env,
    tx: &mut Transaction,
    strategy: RecoveryStrategy,
) -> RecoveryResult {
    match strategy {
        RecoveryStrategy::Retry => {
            tx.state = TransactionState::Pending;
            tx.error_reason = None;
        }
        RecoveryStrategy::Rollback => {
            tx.state = TransactionState::RolledBack;
            tx.completed_at = Some(env.ledger().timestamp());
        }
        RecoveryStrategy::Cancel => {
            tx.state = TransactionState::Cancelled;
            tx.completed_at = Some(env.ledger().timestamp());
        }
    }

    RecoveryResult {
        transaction_id: tx.transaction_id,
        recovered: true,
        message: String::from_str(env, "recovery strategy applied"),
    }
}
