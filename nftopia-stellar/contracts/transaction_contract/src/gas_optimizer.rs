use crate::tx_storage;
use crate::types::{
    GasEstimate, GasOptimizationConfig, NetworkFeeParams, Operation, default_network_fee_params,
};
use crate::utils::gas_calculator;
use soroban_sdk::{Env, Vec};

/// Default tolerance (in basis points) accepted between an estimated and the
/// actually metered CPU instruction count before a diagnostic is emitted.
/// 5,000 bps = 50% deviation.
pub const DEFAULT_GAS_DEVIATION_TOLERANCE_BPS: u32 = 5_000;

/// Diagnostic produced when comparing a pre-flight gas estimate with the gas
/// actually metered by the Soroban host.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GasValidation {
    pub operation_id: u64,
    pub estimated_gas: u64,
    pub metered_gas: u64,
    /// Absolute deviation between estimate and meter, in basis points of the
    /// metered value (0 when the meter is unavailable).
    pub deviation_bps: u32,
    /// Whether the deviation is within the configured tolerance.
    pub within_tolerance: bool,
}

/// Resolve the fee parameters in force: admin-configured values when present,
/// otherwise the calibrated mainnet defaults.
pub fn active_fee_params(env: &Env) -> NetworkFeeParams {
    tx_storage::load_fee_params(env).unwrap_or_else(default_network_fee_params)
}

/// Compute the estimated gas for a set of operations using optimization config
/// and the calibrated mainnet default fee parameters.
///
/// This helper is safe to call outside of a contract invocation context (for
/// example from unit tests).  Contract entrypoints that need the
/// admin-configured parameters should resolve them with [`active_fee_params`]
/// and call [`estimate_with_config_and_params`].
pub fn estimate_with_config(
    env: &Env,
    operations: &Vec<Operation>,
    cfg: &GasOptimizationConfig,
) -> GasEstimate {
    estimate_with_config_and_params(env, operations, cfg, &default_network_fee_params())
}

/// Compute the estimated gas for a set of operations using optimization config
/// and explicit fee parameters.  Used by tests and by callers that already
/// resolved the active parameters.
pub fn estimate_with_config_and_params(
    _env: &Env,
    operations: &Vec<Operation>,
    cfg: &GasOptimizationConfig,
    params: &NetworkFeeParams,
) -> GasEstimate {
    let base = gas_calculator::total_gas_with_params(operations, params);
    let mut estimated_gas = base.estimated_gas;
    let mut estimated_cost = base.estimated_cost;

    // Apply configurable safety multiplier (e.g. 13,000 bps = 1.3x buffer) if
    // configured (> 10_000 bps).  A zero value means "unset" and is normalised
    // to the mainnet-recommended default rather than silently dropping the
    // buffer.
    let multiplier_bps = if cfg.fallback_gas_multiplier_bps == 0 {
        crate::types::DEFAULT_MAINNET_GAS_MULTIPLIER_BPS
    } else {
        cfg.fallback_gas_multiplier_bps
    };

    if multiplier_bps > 10_000 {
        estimated_gas = gas_calculator::apply_multiplier_bps(estimated_gas, multiplier_bps);
        estimated_cost = gas_calculator::apply_multiplier_cost_bps(estimated_cost, multiplier_bps);
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

/// Compare an estimated CPU instruction count against the gas actually metered
/// by the host and report the deviation.
///
/// A metered value of `0` means the host did not expose a meter for the current
/// invocation; the estimate is then considered within tolerance and no
/// diagnostic is raised.
pub fn validate_estimate(
    operation_id: u64,
    estimated_gas: u64,
    metered_gas: u64,
    tolerance_bps: u32,
) -> GasValidation {
    if metered_gas == 0 {
        return GasValidation {
            operation_id,
            estimated_gas,
            metered_gas,
            deviation_bps: 0,
            within_tolerance: true,
        };
    }

    let diff = estimated_gas.abs_diff(metered_gas) as u128;
    let deviation_bps = (diff.saturating_mul(10_000) / metered_gas as u128) as u32;

    GasValidation {
        operation_id,
        estimated_gas,
        metered_gas,
        deviation_bps,
        within_tolerance: deviation_bps <= tolerance_bps,
    }
}

/// Read the host's CPU instruction meter.
///
/// Soroban does not expose gas metering to contracts on mainnet, so outside of
/// tests the meter is unavailable and `0` is returned (which
/// [`validate_estimate`] treats as "no diagnostic").  Under `testutils` the
/// real meter is used so estimates can be validated in a mainnet-like
/// environment.
#[cfg(test)]
fn metered_cpu_instructions(env: &Env) -> u64 {
    env.cost_estimate().budget().cpu_instruction_cost()
}

#[cfg(not(test))]
fn metered_cpu_instructions(_env: &Env) -> u64 {
    0
}

/// Build a gas diagnostic for a single operation using the host's current CPU
/// instruction meter.  Because the meter reflects the whole invocation rather
/// than a single operation, this is a lower-bound diagnostic used to flag
/// estimates that are wildly out of line with observed execution.
pub fn operation_gas_diagnostic(env: &Env, op: &Operation, tolerance_bps: u32) -> GasValidation {
    let estimated_gas = gas_calculator::op_gas(op);
    let metered_gas = metered_cpu_instructions(env);
    validate_estimate(op.operation_id, estimated_gas, metered_gas, tolerance_bps)
}

/// Production-safe validation: ensure the estimate for an operation stays
/// within the per-operation resource ceiling declared by the caller (when
/// one is set).
pub fn validate_operation_gas_limit(
    op: &Operation,
    estimated_gas: u64,
) -> Result<(), crate::error::TransactionError> {
    if let Some(limit) = op.gas_limit
        && estimated_gas > limit
    {
        return Err(crate::error::TransactionError::GasLimitExceeded);
    }
    Ok(())
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
