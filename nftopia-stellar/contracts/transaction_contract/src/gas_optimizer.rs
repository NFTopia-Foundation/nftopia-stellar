use crate::types::{GasEstimate, GasOptimizationConfig, Operation};
use crate::utils::gas_calculator;
use soroban_sdk::{Env, Vec};

// Compute the estimated gas for a set of operations using optimization config.
pub fn estimate_with_config(
    _env: &Env,
    operations: &Vec<Operation>,
    cfg: &GasOptimizationConfig,
) -> GasEstimate {
    let base = gas_calculator::total_gas(operations);
    if cfg.enable_caching {
        GasEstimate {
            estimated_gas: gas_calculator::apply_multiplier_bps(base.estimated_gas, 9_800),
            estimated_cost: base.estimated_cost,
        }
    } else {
        base
    }
}

// Placeholder reordering hook. Returns same order now for deterministic draft behavior.
pub fn reorder_for_efficiency(
    env: &Env,
    operations: &Vec<Operation>,
    _cfg: &GasOptimizationConfig,
) -> Vec<Operation> {
    let mut out = Vec::new(env);
    for op in operations.iter() {
        out.push_back(op);
    }
    out
}
