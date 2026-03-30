use soroban_sdk::{Address, Bytes, Env, Map, String, Vec, contract, contractimpl};

use crate::error::TransactionError;
use crate::events;
use crate::storage;
use crate::types::{
    BatchExecutionResult, ExecutionResult, GasEstimate, GasOptimizationConfig, Operation,
    OperationResult, RecoveryResult, RecoveryStrategy, SignatureRecord, Transaction,
    TransactionBlueprint, TransactionState, TransactionStatus, default_gas_config,
};

const GAS_BASE_PER_OPERATION: u64 = 100;
const GAS_PER_PARAM: u64 = 15;
const GAS_PER_DEPENDENCY: u64 = 10;
const STROOPS_PER_GAS: i128 = 1;

#[contract]
pub struct TransactionContract;

#[contractimpl]
impl TransactionContract {
    pub fn create_transaction(
        env: Env,
        creator: Address,
        metadata: Map<String, String>,
        initial_operations: Vec<Operation>,
    ) -> Result<u64, TransactionError> {
        storage::require_creator_auth(&creator);

        let transaction_id = storage::next_transaction_id(&env);
        let now = env.ledger().timestamp();

        let tx = Transaction {
            transaction_id,
            creator: creator.clone(),
            operations: initial_operations,
            state: TransactionState::Draft,
            created_at: now,
            started_at: None,
            completed_at: None,
            total_gas_used: 0,
            total_cost: 0,
            error_reason: None,
            rollback_operations: Vec::new(&env),
            signatures: Vec::new(&env),
            metadata,
        };

        storage::save_transaction(&env, &tx);
        events::publish_created(&env, transaction_id, &creator);

        Ok(transaction_id)
    }

    pub fn add_operation(
        env: Env,
        transaction_id: u64,
        operation: Operation,
    ) -> Result<u64, TransactionError> {
        let mut tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;
        storage::require_creator_auth(&tx.creator);

        if tx.state != TransactionState::Draft && tx.state != TransactionState::Pending {
            return Err(TransactionError::InvalidStateTransition);
        }

        if operation.operation_id == 0 {
            return Err(TransactionError::InvalidOperation);
        }

        tx.operations.push_back(operation.clone());
        tx.rollback_operations.push_back(operation.clone());

        storage::save_transaction(&env, &tx);
        Ok(operation.operation_id)
    }

    pub fn execute_transaction(
        env: Env,
        transaction_id: u64,
        max_gas: Option<u64>,
        _optimization_config: Option<GasOptimizationConfig>,
    ) -> Result<ExecutionResult, TransactionError> {
        let mut tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;
        storage::require_creator_auth(&tx.creator);

        if tx.state == TransactionState::Completed
            || tx.state == TransactionState::Cancelled
            || tx.state == TransactionState::RolledBack
        {
            return Err(TransactionError::AlreadyFinalized);
        }

        let original_state = tx.state.clone();
        tx.state = TransactionState::Executing;
        tx.started_at = Some(env.ledger().timestamp());
        events::publish_state_changed(&env, tx.transaction_id, &original_state, &tx.state);

        let mut succeeded_ids = Vec::new(&env);
        let mut results = Vec::new(&env);
        let mut used_gas = 0_u64;
        let mut successful_operations = 0_u32;

        for op in tx.operations.iter() {
            if !dependencies_satisfied(&succeeded_ids, &op.dependencies) {
                tx.state = TransactionState::Failed;
                tx.error_reason = Some(String::from_str(&env, "operation dependency not met"));
                events::publish_failed(
                    &env,
                    tx.transaction_id,
                    &tx.error_reason.clone().unwrap_or(String::from_str(&env, "unknown")),
                );
                tx.state = TransactionState::RolledBack;
                tx.completed_at = Some(env.ledger().timestamp());
                storage::save_transaction(&env, &tx);
                return Err(TransactionError::DependencyNotMet);
            }

            let op_gas = estimate_operation_gas(&op);
            used_gas = used_gas.saturating_add(op_gas);

            if let Some(max) = max_gas {
                if used_gas > max {
                    tx.state = TransactionState::Failed;
                    tx.error_reason = Some(String::from_str(&env, "max gas exceeded"));
                    events::publish_failed(
                        &env,
                        tx.transaction_id,
                        &tx.error_reason.clone().unwrap_or(String::from_str(&env, "unknown")),
                    );
                    tx.state = TransactionState::RolledBack;
                    tx.completed_at = Some(env.ledger().timestamp());
                    storage::save_transaction(&env, &tx);
                    return Err(TransactionError::GasLimitExceeded);
                }
            }

            let result = OperationResult {
                operation_id: op.operation_id,
                success: true,
                result_data: None,
                gas_used: op_gas,
                error_message: None,
                executed_at: env.ledger().timestamp(),
            };
            results.push_back(result);
            succeeded_ids.push_back(op.operation_id);
            successful_operations += 1;
        }

        tx.total_gas_used = used_gas;
        tx.total_cost = (used_gas as i128) * STROOPS_PER_GAS;
        tx.completed_at = Some(env.ledger().timestamp());
        tx.state = TransactionState::Completed;

        storage::save_transaction(&env, &tx);
        events::publish_state_changed(&env, tx.transaction_id, &TransactionState::Executing, &tx.state);

        Ok(ExecutionResult {
            transaction_id,
            final_state: tx.state,
            successful_operations,
            failed_operations: 0,
            total_gas_used: tx.total_gas_used,
            results,
        })
    }

    pub fn cancel_transaction(
        env: Env,
        transaction_id: u64,
        reason: String,
    ) -> Result<(), TransactionError> {
        let mut tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;
        storage::require_creator_auth(&tx.creator);

        if tx.state == TransactionState::Completed || tx.state == TransactionState::RolledBack {
            return Err(TransactionError::AlreadyFinalized);
        }

        let old_state = tx.state.clone();
        tx.state = TransactionState::Cancelled;
        tx.error_reason = Some(reason);
        tx.completed_at = Some(env.ledger().timestamp());
        storage::save_transaction(&env, &tx);
        events::publish_state_changed(&env, tx.transaction_id, &old_state, &tx.state);

        Ok(())
    }

    pub fn estimate_transaction_gas(env: Env, transaction_id: u64) -> Result<GasEstimate, TransactionError> {
        let tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;

        let mut gas = 0_u64;
        for op in tx.operations.iter() {
            gas = gas.saturating_add(estimate_operation_gas(&op));
        }

        Ok(GasEstimate {
            estimated_gas: gas,
            estimated_cost: (gas as i128) * STROOPS_PER_GAS,
        })
    }

    pub fn batch_create_transactions(
        env: Env,
        transactions: Vec<TransactionBlueprint>,
    ) -> Result<Vec<u64>, TransactionError> {
        let mut ids = Vec::new(&env);
        for blueprint in transactions.iter() {
            let id = Self::create_transaction(
                env.clone(),
                blueprint.creator,
                blueprint.metadata,
                blueprint.initial_operations,
            )?;
            ids.push_back(id);
        }
        Ok(ids)
    }

    pub fn batch_execute_transactions(
        env: Env,
        transaction_ids: Vec<u64>,
        _optimization_config: GasOptimizationConfig,
    ) -> Result<BatchExecutionResult, TransactionError> {
        let mut succeeded = 0_u32;
        let mut failed = 0_u32;
        let mut result_ids = Vec::new(&env);

        for tx_id in transaction_ids.iter() {
            match Self::execute_transaction(env.clone(), tx_id, None, None) {
                Ok(_) => {
                    succeeded += 1;
                    result_ids.push_back(tx_id);
                }
                Err(_) => {
                    failed += 1;
                }
            }
        }

        Ok(BatchExecutionResult {
            total_transactions: succeeded + failed,
            succeeded,
            failed,
            result_ids,
        })
    }

    pub fn add_signature(
        env: Env,
        transaction_id: u64,
        signer: Address,
        signature: Bytes,
    ) -> Result<(), TransactionError> {
        let mut tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;
        signer.require_auth();

        let signature_record = SignatureRecord {
            signer,
            signature,
            obtained_at: env.ledger().timestamp(),
        };

        tx.signatures.push_back(signature_record);
        storage::save_transaction(&env, &tx);
        Ok(())
    }

    pub fn verify_signatures(env: Env, transaction_id: u64) -> Result<bool, TransactionError> {
        let tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;

        if tx.signatures.is_empty() {
            return Err(TransactionError::SignatureMissing);
        }

        Ok(true)
    }

    pub fn recover_transaction(
        env: Env,
        transaction_id: u64,
        recovery_strategy: RecoveryStrategy,
    ) -> Result<RecoveryResult, TransactionError> {
        let mut tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;
        storage::require_creator_auth(&tx.creator);

        match recovery_strategy {
            RecoveryStrategy::Retry => {
                if tx.state != TransactionState::Failed {
                    return Err(TransactionError::InvalidStateTransition);
                }
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

        storage::save_transaction(&env, &tx);

        Ok(RecoveryResult {
            transaction_id,
            recovered: true,
            message: String::from_str(&env, "recovery strategy applied"),
        })
    }

    pub fn get_transaction_status(
        env: Env,
        transaction_id: u64,
    ) -> Result<TransactionStatus, TransactionError> {
        let tx = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;

        let total_operations = tx.operations.len();
        let completed_operations = match tx.state {
            TransactionState::Completed => total_operations,
            _ => 0,
        };

        Ok(TransactionStatus {
            transaction_id,
            state: tx.state,
            completed_operations,
            total_operations,
            error_reason: tx.error_reason,
        })
    }

    pub fn optimize_transaction_flow(
        env: Env,
        transaction_id: u64,
        _config: GasOptimizationConfig,
    ) -> Result<GasOptimizationConfig, TransactionError> {
        let _ = storage::load_transaction(&env, transaction_id)
            .ok_or(TransactionError::TransactionNotFound)?;
        Ok(default_gas_config(&env))
    }
}

fn dependencies_satisfied(succeeded_ids: &Vec<u64>, required_dependencies: &Vec<u64>) -> bool {
    for dep in required_dependencies.iter() {
        if !succeeded_ids.contains(dep) {
            return false;
        }
    }
    true
}

fn estimate_operation_gas(op: &Operation) -> u64 {
    let param_cost = (op.parameters.len() as u64).saturating_mul(GAS_PER_PARAM);
    let dep_cost = (op.dependencies.len() as u64).saturating_mul(GAS_PER_DEPENDENCY);
    GAS_BASE_PER_OPERATION
        .saturating_add(param_cost)
        .saturating_add(dep_cost)
}
