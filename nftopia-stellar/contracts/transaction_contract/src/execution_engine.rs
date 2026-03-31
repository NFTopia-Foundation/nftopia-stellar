use crate::dependency_resolver;
use crate::error::TransactionError;
use crate::types::{Operation, OperationResult};
use crate::utils::gas_calculator;
use soroban_sdk::{Env, Vec};

// Simulate execution of one operation for orchestration-level accounting.
pub fn execute_operation(env: &Env, op: &Operation) -> OperationResult {
    OperationResult {
        operation_id: op.operation_id,
        success: true,
        result_data: None,
        gas_used: gas_calculator::op_gas(op),
        error_message: None,
        executed_at: env.ledger().timestamp(),
    }
}

// Execute operations in dependency-safe order.
pub fn execute_operations(
    env: &Env,
    operations: &Vec<Operation>,
) -> Result<Vec<OperationResult>, TransactionError> {
    let ordered = dependency_resolver::resolve_execution_order(env, operations);
    let mut completed_ids = Vec::new(env);
    let mut results = Vec::new(env);

    for op in ordered.iter() {
        if !dependency_resolver::dependencies_satisfied(&completed_ids, &op) {
            return Err(TransactionError::DependencyNotMet);
        }
        let result = execute_operation(env, &op);
        completed_ids.push_back(op.operation_id);
        results.push_back(result);
    }

    Ok(results)
}
