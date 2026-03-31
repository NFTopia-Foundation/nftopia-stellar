//! Gas calculator — deterministic cost model for Soroban transaction operations.
//! Base costs and per-parameter costs are intentionally conservative to leave a
//! safety margin before the actual ledger gas ceiling is reached.

use crate::types::{GasEstimate, Operation};
use soroban_sdk::Vec;

pub const GAS_BASE_PER_OPERATION: u64 = 100;
pub const GAS_PER_PARAM: u64 = 15;
pub const GAS_PER_DEPENDENCY: u64 = 10;
pub const STROOPS_PER_GAS: i128 = 1;

/// Estimate the gas cost of a single operation.
pub fn op_gas(op: &Operation) -> u64 {
    let param_cost = (op.parameters.len() as u64).saturating_mul(GAS_PER_PARAM);
    let dep_cost = (op.dependencies.len() as u64).saturating_mul(GAS_PER_DEPENDENCY);
    GAS_BASE_PER_OPERATION
        .saturating_add(param_cost)
        .saturating_add(dep_cost)
}

/// Estimate the total gas for a list of operations.
pub fn total_gas(operations: &Vec<Operation>) -> GasEstimate {
    let mut gas: u64 = 0;
    for op in operations.iter() {
        gas = gas.saturating_add(op_gas(&op));
    }
    GasEstimate {
        estimated_gas: gas,
        estimated_cost: (gas as i128).saturating_mul(STROOPS_PER_GAS),
    }
}

/// Apply a multiplier expressed in basis points (10_000 = 1×) to a gas value.
/// Used by the fallback_gas_multiplier_bps config field.
pub fn apply_multiplier_bps(gas: u64, bps: u32) -> u64 {
    ((gas as u128)
        .saturating_mul(bps as u128)
        .saturating_div(10_000)) as u64
}
