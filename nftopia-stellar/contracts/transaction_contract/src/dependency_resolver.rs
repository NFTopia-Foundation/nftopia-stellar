use crate::types::Operation;
use soroban_sdk::{Env, Vec};

// Returns true when all dependencies of `operation` are already completed.
pub fn dependencies_satisfied(completed_operation_ids: &Vec<u64>, operation: &Operation) -> bool {
    for dep in operation.dependencies.iter() {
        if !completed_operation_ids.contains(dep) {
            return false;
        }
    }
    true
}

// Draft deterministic execution order. For now this returns insertion order.
pub fn resolve_execution_order(env: &Env, operations: &Vec<Operation>) -> Vec<Operation> {
    let mut ordered = Vec::new(env);
    for op in operations.iter() {
        ordered.push_back(op);
    }
    ordered
}
