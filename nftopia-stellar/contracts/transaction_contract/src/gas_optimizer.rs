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
    let mut estimated_gas = base.estimated_gas;
    let mut estimated_cost = base.estimated_cost;

    // Apply configurable safety multiplier (e.g. 12,000 bps = 1.2x buffer) if configured (> 10_000 bps)
    if cfg.fallback_gas_multiplier_bps > 10_000 {
        estimated_gas =
            gas_calculator::apply_multiplier_bps(estimated_gas, cfg.fallback_gas_multiplier_bps);
        estimated_cost = gas_calculator::apply_multiplier_cost_bps(
            estimated_cost,
            cfg.fallback_gas_multiplier_bps,
        );
    }

    if cfg.enable_caching {
        let discount_bps =
            if cfg.fallback_gas_multiplier_bps > 0 && cfg.fallback_gas_multiplier_bps < 10_000 {
                cfg.fallback_gas_multiplier_bps
            } else {
                9_800 // Default calibrated 2% caching optimization discount
            };
        GasEstimate {
            estimated_gas: gas_calculator::apply_multiplier_bps(estimated_gas, discount_bps),
            estimated_cost: gas_calculator::apply_multiplier_cost_bps(estimated_cost, discount_bps),
        }
    } else {
        GasEstimate {
            estimated_gas,
            estimated_cost,
        }
    }
}

// Dependency-safe, gas-aware reordering (#291): operations that target the same
// contract are run back to back so the host can reuse the already loaded
// instance entry, which is the most expensive read in the fee model. The result
// is always a valid topological order, so this can never break a dependency.
pub fn reorder_for_efficiency(
    env: &Env,
    operations: &Vec<Operation>,
    cfg: &GasOptimizationConfig,
) -> Vec<Operation> {
    if !cfg.enable_reordering {
        let mut out = Vec::new(env);
        for op in operations.iter() {
            out.push_back(op);
        }
        return out;
    }
    match crate::dependency_resolver::DependencyGraph::build_clustered(env, operations) {
        Ok(graph) => graph.operations,
        // An unresolvable graph is the caller's problem to report; returning the
        // input unchanged keeps this function total and lets the execution path
        // surface the real error.
        Err(_) => {
            let mut out = Vec::new(env);
            for op in operations.iter() {
                out.push_back(op);
            }
            out
        }
    }
}
