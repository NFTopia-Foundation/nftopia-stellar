//! Gas calculator — calibrated Soroban mainnet cost model for transaction operations.
//! Replaces arbitrary testnet placeholders with CPU instruction profiling, WASM payload sizing,
//! operation-type differentiation, dynamic fee ladder pricing, and maximum transaction ceiling validation.

use crate::error::TransactionError;
use crate::types::{GasEstimate, Operation, OperationType};
use soroban_sdk::Vec;

/// Soroban Mainnet maximum CPU instruction ceiling per transaction (100M instructions).
pub const MAINNET_MAX_CPU_INSTRUCTIONS: u64 = 100_000_000;

/// Soroban Mainnet baseline fee ladder: Stroops charged per 10,000 CPU instructions.
pub const MAINNET_STROOPS_PER_10K_INSTRUCTIONS: i128 = 25;

/// Baseline storage entry read cost in Stroops based on mainnet fee ledger parameters.
pub const STROOPS_PER_READ_ENTRY: i128 = 5_000;

/// Baseline storage entry write cost in Stroops based on mainnet fee ledger parameters.
pub const STROOPS_PER_WRITE_ENTRY: i128 = 10_000;

/// CPU instructions allocated per parameter payload byte (WASM serialization overhead).
pub const CPU_INSTRUCTIONS_PER_PARAM_BYTE: u64 = 50;

/// Base CPU instructions allocated per operation parameter.
pub const CPU_INSTRUCTIONS_PER_PARAM_BASE: u64 = 1_500;

/// CPU instructions allocated per cross-contract dependency invocation and state check.
pub const CPU_INSTRUCTIONS_PER_DEPENDENCY: u64 = 5_000;

/// Legacy constant retained for backward compatibility.
pub const STROOPS_PER_GAS: i128 = 1;

/// Estimate baseline CPU instructions required for execution based on OperationType.
pub fn operation_type_base_instructions(op_type: &OperationType) -> u64 {
    match op_type {
        OperationType::NftMint => 25_000,
        OperationType::NftTransfer => 15_000,
        OperationType::NftApprove => 12_000,
        OperationType::MarketplaceList => 18_000,
        OperationType::MarketplaceBid => 20_000,
        OperationType::SettlementEscrow => 30_000,
        OperationType::SettlementRelease => 28_000,
        OperationType::PaymentTransfer => 10_000,
        OperationType::RoyaltyDistribution => 35_000,
        OperationType::MetadataUpdate => 14_000,
        OperationType::VerificationCheck => 8_000,
    }
}

/// Estimate total CPU instructions for a single operation accounting for WASM execution,
/// parameter decoding payload size, and dependency invocation overhead.
pub fn op_gas(op: &Operation) -> u64 {
    let base_instructions = operation_type_base_instructions(&op.operation_type);

    let mut param_payload_bytes: u64 = 0;
    for param in op.parameters.iter() {
        param_payload_bytes = param_payload_bytes.saturating_add(param.value.len() as u64);
    }

    let param_cost = (op.parameters.len() as u64)
        .saturating_mul(CPU_INSTRUCTIONS_PER_PARAM_BASE)
        .saturating_add(param_payload_bytes.saturating_mul(CPU_INSTRUCTIONS_PER_PARAM_BYTE));

    let dep_cost = (op.dependencies.len() as u64).saturating_mul(CPU_INSTRUCTIONS_PER_DEPENDENCY);

    base_instructions
        .saturating_add(param_cost)
        .saturating_add(dep_cost)
}

/// Calculate Stroop cost from estimated CPU instructions and dependency footprint using mainnet fee ladder parameters.
pub fn calculate_stroop_cost(gas_instructions: u64, dependency_count: usize) -> i128 {
    let instruction_cost = (gas_instructions as i128)
        .saturating_mul(MAINNET_STROOPS_PER_10K_INSTRUCTIONS)
        .saturating_div(10_000);

    // Approximate storage footprint from cross-contract dependencies (1 read + 1 write entry per dependency)
    let storage_cost = (dependency_count as i128)
        .saturating_mul(STROOPS_PER_READ_ENTRY.saturating_add(STROOPS_PER_WRITE_ENTRY));

    // Base minimum transaction inclusion fee on Stellar mainnet (100 stroops = 0.00001 XLM)
    let min_inclusion_fee: i128 = 100;

    min_inclusion_fee
        .saturating_add(instruction_cost)
        .saturating_add(storage_cost)
}

/// Estimate the total gas and stroop cost for a list of operations.
pub fn total_gas(operations: &Vec<Operation>) -> GasEstimate {
    let mut total_instructions: u64 = 0;
    let mut total_deps: usize = 0;

    for op in operations.iter() {
        total_instructions = total_instructions.saturating_add(op_gas(&op));
        total_deps = total_deps.saturating_add(op.dependencies.len() as usize);
    }

    let estimated_cost = calculate_stroop_cost(total_instructions, total_deps);

    GasEstimate {
        estimated_gas: total_instructions,
        estimated_cost,
    }
}

/// Validates that estimated gas does not exceed mainnet transaction maximum limits.
pub fn validate_gas_limits(operations: &Vec<Operation>) -> Result<(), TransactionError> {
    let estimate = total_gas(operations);
    if estimate.estimated_gas > MAINNET_MAX_CPU_INSTRUCTIONS {
        return Err(TransactionError::GasLimitExceeded);
    }
    Ok(())
}

/// Apply a multiplier expressed in basis points (10_000 = 1×) to a gas value.
pub fn apply_multiplier_bps(gas: u64, bps: u32) -> u64 {
    ((gas as u128)
        .saturating_mul(bps as u128)
        .saturating_div(10_000)) as u64
}

/// Apply a multiplier expressed in basis points (10_000 = 1×) to a cost value.
pub fn apply_multiplier_cost_bps(cost: i128, bps: u32) -> i128 {
    ((cost as i128)
        .saturating_mul(bps as i128)
        .saturating_div(10_000)) as i128
}

