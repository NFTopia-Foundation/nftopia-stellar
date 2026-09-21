use crate::dependency_resolver;
use crate::error::TransactionError;
use crate::events;
use crate::gas_optimizer::{self, DEFAULT_GAS_DEVIATION_TOLERANCE_BPS};
use crate::types::{Operation, OperationResult};
use crate::utils::gas_calculator;
use soroban_sdk::{Env, String, Vec};

// Simulate execution of one operation for orchestration-level accounting.
//
// The pre-flight gas estimate is recorded as `gas_used` and additionally
// validated against the host's CPU instruction meter.  When the two diverge
// beyond the configured tolerance a `GasEstimateDeviation` diagnostic event is
// emitted so the estimate can be re-calibrated; the operation itself is not
// rejected on the basis of a diagnostic.
pub fn execute_operation(env: &Env, op: &Operation) -> OperationResult {
    let gas_used = gas_calculator::op_gas(op);

    let diagnostic =
        gas_optimizer::operation_gas_diagnostic(env, op, DEFAULT_GAS_DEVIATION_TOLERANCE_BPS);
    if !diagnostic.within_tolerance {
        events::publish_gas_deviation(
            env,
            diagnostic.operation_id,
            diagnostic.estimated_gas,
            diagnostic.metered_gas,
            diagnostic.deviation_bps,
        );
    }

    // Enforce the caller-declared per-operation ceiling.  Estimates that
    // cannot fit are reported as a failed operation rather than silently
    // overpaying.
    let within_limit = gas_optimizer::validate_operation_gas_limit(op, gas_used).is_ok();

    OperationResult {
        operation_id: op.operation_id,
        success: within_limit,
        result_data: None,
        gas_used,
        error_message: if within_limit {
            None
        } else {
            Some(String::from_str(
                env,
                "estimated gas exceeds operation gas limit",
            ))
        },
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
