//! Gas calculator — calibrated Soroban mainnet cost model for transaction operations.
//!
//! The model replaces the original arbitrary testnet placeholders
//! (`GAS_BASE_PER_OPERATION = 100`, `GAS_PER_PARAM = 15`, `STROOPS_PER_GAS = 1`)
//! with an explicit decomposition of the resources that Stellar mainnet
//! actually charges for:
//!
//! 1. **CPU instructions** — profiled per [`OperationType`] from contract
//!    benchmarks, plus payload-decoding and cross-contract call overhead.
//! 2. **Ledger entry read/write fees** — charged per entry touched and per
//!    byte of the serialized entry.
//! 3. **TTL extension (state archival rent)** — charged for the ledgers of
//!    lifetime bought for entries created or modified by the operation.
//! 4. **Network congestion uplift** — a dynamic multiplier applied on top of
//!    the fee-ladder price during congestion.
//!
//! Sources:
//! - Stellar docs — "Resource limits and fees":
//!   <https://developers.stellar.org/docs/learn/smart-contract-internals/resource-limits-fees>
//! - Stellar docs — "State archival / rent":
//!   <https://developers.stellar.org/docs/learn/smart-contract-internals/state-archival>
//! - stellar-core `ConfigSettingContractComputeV0`
//!   (`feeRatePerInstructionsIncrement`) and
//!   `ConfigSettingContractLedgerCostV0` (`feeReadLedgerEntry`,
//!   `feeWriteLedgerEntry`, `feeRead1KB`, ...).
//!
//! All rates are supplied through [`NetworkFeeParams`] so an admin can
//! re-calibrate them when the network ledger configuration changes.

use crate::error::TransactionError;
use crate::types::{
    GasEstimate, NetworkFeeParams, Operation, OperationType, default_network_fee_params,
};
use soroban_sdk::Vec;

/// Soroban Mainnet maximum CPU instruction ceiling per transaction (100M instructions).
pub const MAINNET_MAX_CPU_INSTRUCTIONS: u64 = 100_000_000;

/// CPU instructions allocated per parameter payload byte (WASM serialization overhead).
pub const CPU_INSTRUCTIONS_PER_PARAM_BYTE: u64 = 50;

/// Base CPU instructions allocated per operation parameter.
pub const CPU_INSTRUCTIONS_PER_PARAM_BASE: u64 = 1_500;

/// CPU instructions allocated per cross-contract dependency invocation and state check.
pub const CPU_INSTRUCTIONS_PER_DEPENDENCY: u64 = 5_000;

/// Base minimum transaction inclusion fee on Stellar mainnet (100 stroops = 0.00001 XLM).
pub const MIN_INCLUSION_FEE_STROOPS: i128 = 100;

/// Ledger-entry footprint charged by one operation, before parameter payloads.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StorageProfile {
    /// Number of ledger entries read by the operation.
    pub entries_read: u64,
    /// Number of ledger entries created or modified by the operation.
    pub entries_written: u64,
    /// Serialized bytes read from ledger entries.
    pub bytes_read: u64,
    /// Serialized bytes written to ledger entries.
    pub bytes_written: u64,
}

/// Baseline CPU instructions required for execution based on [`OperationType`].
///
/// Values are derived from contract-level benchmarks: a mint performs
/// ownership/metadata/royalty writes and is the most expensive, while a
/// verification check is a read-only assertion.
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

/// Ledger-entry read/write footprint charged by each [`OperationType`].
///
/// Byte counts approximate the serialized size of the entries an operation
/// touches on mainnet (ownership records, metadata blobs, escrow/listing
/// records, royalty tables, ...).
pub fn operation_type_storage_profile(op_type: &OperationType) -> StorageProfile {
    match op_type {
        OperationType::NftMint => StorageProfile {
            entries_read: 2,
            entries_written: 3,
            bytes_read: 512,
            bytes_written: 1_536,
        },
        OperationType::NftTransfer => StorageProfile {
            entries_read: 2,
            entries_written: 2,
            bytes_read: 512,
            bytes_written: 768,
        },
        OperationType::NftApprove => StorageProfile {
            entries_read: 1,
            entries_written: 1,
            bytes_read: 256,
            bytes_written: 256,
        },
        OperationType::MarketplaceList => StorageProfile {
            entries_read: 1,
            entries_written: 2,
            bytes_read: 256,
            bytes_written: 768,
        },
        OperationType::MarketplaceBid => StorageProfile {
            entries_read: 2,
            entries_written: 2,
            bytes_read: 512,
            bytes_written: 768,
        },
        OperationType::SettlementEscrow => StorageProfile {
            entries_read: 2,
            entries_written: 2,
            bytes_read: 512,
            bytes_written: 1_024,
        },
        OperationType::SettlementRelease => StorageProfile {
            entries_read: 3,
            entries_written: 2,
            bytes_read: 768,
            bytes_written: 768,
        },
        OperationType::PaymentTransfer => StorageProfile {
            entries_read: 2,
            entries_written: 2,
            bytes_read: 512,
            bytes_written: 512,
        },
        OperationType::RoyaltyDistribution => StorageProfile {
            entries_read: 3,
            entries_written: 3,
            bytes_read: 1_024,
            bytes_written: 1_536,
        },
        OperationType::MetadataUpdate => StorageProfile {
            entries_read: 1,
            entries_written: 1,
            bytes_read: 256,
            bytes_written: 1_024,
        },
        OperationType::VerificationCheck => StorageProfile {
            entries_read: 1,
            entries_written: 0,
            bytes_read: 256,
            bytes_written: 0,
        },
    }
}

/// Estimate total CPU instructions for a single operation accounting for WASM
/// execution, parameter decoding payload size, and dependency invocation
/// overhead.
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

/// Ledger-entry footprint of a single operation, including the serialized
/// parameter payload (read as transaction input) in the read-byte count.
pub fn op_storage_profile(op: &Operation) -> StorageProfile {
    let mut profile = operation_type_storage_profile(&op.operation_type);

    let mut param_payload_bytes: u64 = 0;
    for param in op.parameters.iter() {
        param_payload_bytes = param_payload_bytes.saturating_add(param.value.len() as u64);
    }
    profile.bytes_read = profile.bytes_read.saturating_add(param_payload_bytes);
    profile
}

/// TTL-extension (state archival rent) cost for an operation's writes.
///
/// Rent is charged per byte of ledger entry per ledger of lifetime purchased,
/// approximated here as `bytes_written * ttl_ledgers * stroops_per_ttl_ledger`.
pub fn estimate_ttl_cost(profile: &StorageProfile, params: &NetworkFeeParams) -> i128 {
    let written_bytes = profile.bytes_written as i128;
    let ledgers = params.ttl_extension_ledgers as i128;
    written_bytes
        .saturating_mul(ledgers)
        .saturating_mul(params.stroops_per_ttl_ledger)
}

/// Apply the network congestion uplift to a stroop subtotal.
///
/// A value of `0` is treated as "unset" and normalises to 10,000 bps (1.0x) so
/// that partially populated configs never under-price a transaction.
pub fn apply_congestion_uplift(subtotal: i128, params: &NetworkFeeParams) -> i128 {
    let bps = if params.congestion_multiplier_bps == 0 {
        10_000
    } else {
        params.congestion_multiplier_bps
    };
    subtotal.saturating_mul(bps as i128).saturating_div(10_000)
}

/// Compute the stroop cost of a transaction from its CPU instructions and
/// ledger footprint using the supplied mainnet fee parameters.
///
/// `cost = min_inclusion_fee
///        + instructions * stroops_per_10k_instructions / 10_000
///        + entries_read * stroops_per_read_entry
///        + entries_written * stroops_per_write_entry
///        + bytes_read * stroops_per_read_byte
///        + bytes_written * stroops_per_write_byte
///        + ttl_cost`
///
/// The subtotal is then scaled by the network congestion multiplier.
pub fn calculate_stroop_cost_with_params(
    gas_instructions: u64,
    profile: &StorageProfile,
    params: &NetworkFeeParams,
) -> i128 {
    let instruction_cost = (gas_instructions as i128)
        .saturating_mul(params.stroops_per_10k_instructions)
        .saturating_div(10_000);

    let entry_cost = (profile.entries_read as i128)
        .saturating_mul(params.stroops_per_read_entry)
        .saturating_add(
            (profile.entries_written as i128).saturating_mul(params.stroops_per_write_entry),
        );

    let byte_cost = (profile.bytes_read as i128)
        .saturating_mul(params.stroops_per_read_byte)
        .saturating_add(
            (profile.bytes_written as i128).saturating_mul(params.stroops_per_write_byte),
        );

    let ttl_cost = estimate_ttl_cost(profile, params);

    let subtotal = MIN_INCLUSION_FEE_STROOPS
        .saturating_add(instruction_cost)
        .saturating_add(entry_cost)
        .saturating_add(byte_cost)
        .saturating_add(ttl_cost);

    apply_congestion_uplift(subtotal, params)
}

/// Stroop cost for a single operation under the supplied fee parameters.
pub fn op_stroop_cost(op: &Operation, params: &NetworkFeeParams) -> i128 {
    calculate_stroop_cost_with_params(op_gas(op), &op_storage_profile(op), params)
}

/// Calculate Stroop cost from estimated CPU instructions and dependency
/// footprint using the default mainnet fee ladder parameters.
///
/// Retained for backwards compatibility; callers that have calibrated
/// parameters should prefer [`calculate_stroop_cost_with_params`].
pub fn calculate_stroop_cost(gas_instructions: u64, dependency_count: usize) -> i128 {
    // Approximate storage footprint from cross-contract dependencies
    // (1 read + 1 write entry per dependency).
    let deps = dependency_count as u64;
    let profile = StorageProfile {
        entries_read: deps,
        entries_written: deps,
        bytes_read: deps.saturating_mul(256),
        bytes_written: deps.saturating_mul(256),
    };
    calculate_stroop_cost_with_params(gas_instructions, &profile, &default_network_fee_params())
}

/// Estimate the total gas and stroop cost for a list of operations using the
/// default mainnet fee parameters.
pub fn total_gas(operations: &Vec<Operation>) -> GasEstimate {
    total_gas_with_params(operations, &default_network_fee_params())
}

/// Estimate the total gas and stroop cost for a list of operations under the
/// supplied mainnet fee parameters.  Storage, byte and TTL fees are folded
/// into the stroop cost, while `estimated_gas` remains the CPU instruction
/// count used for the network resource ceiling.
pub fn total_gas_with_params(
    operations: &Vec<Operation>,
    params: &NetworkFeeParams,
) -> GasEstimate {
    let mut total_instructions: u64 = 0;
    let mut total_cost: i128 = 0;

    for op in operations.iter() {
        total_instructions = total_instructions.saturating_add(op_gas(&op));
        total_cost = total_cost.saturating_add(op_stroop_cost(&op, params));
    }

    GasEstimate {
        estimated_gas: total_instructions,
        estimated_cost: total_cost,
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
    cost.saturating_mul(bps as i128).saturating_div(10_000)
}
