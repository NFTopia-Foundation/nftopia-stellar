use crate::error::TransactionError;
use crate::security::{resource_guard, validation_engine};
use crate::types::Operation;
use soroban_sdk::{Env, Vec};

// Validate one operation using central guards.
pub fn validate_operation(env: &Env, operation: &Operation) -> Result<(), TransactionError> {
    validation_engine::validate_operation(env, operation)?;
    resource_guard::check_param_count(operation.parameters.len(), env)?;
    Ok(())
}

// Validate a full operation list.
pub fn validate_operation_set(
    env: &Env,
    operations: &Vec<Operation>,
) -> Result<(), TransactionError> {
    resource_guard::check_operation_count(operations.len(), env)?;
    for op in operations.iter() {
        validate_operation(env, &op)?;
    }
    Ok(())
}
