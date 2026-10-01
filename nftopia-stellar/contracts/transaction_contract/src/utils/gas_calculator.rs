//! Gas & fee calculator — an on-chain mirror of the Soroban **Pubnet**
//! resource-fee ladder.
//!
//! Earlier versions of this module priced operations with two arbitrary
//! constants (`GAS_BASE_PER_OPERATION = 100`, `STROOPS_PER_GAS = 1`) that were
//! tuned against a local testnet. A real Soroban transaction is priced on
//! *eight* independent resource dimensions, and the on-chain fee is computed as
//! `ceil(resource_value * fee_rate / increment)` per dimension. This module
//! reproduces that model (see `soroban_env_host::fees::FeeConfiguration` and
//! `InvocationResources::estimate_fees`) so the gas the contract quotes is the
//! gas the network actually bills.
//!
//! # Refreshing the ladder
//!
//! Network fees live in ledger configuration entries that a contract *cannot*
//! read (`Env` only exposes `ledger().sequence()/timestamp()` and
//! `storage().max_ttl()`). They therefore have to be mirrored. The defaults
//! below are copied value-for-value from the Pubnet snapshot in
//! `soroban_sdk::testutils::CostEstimate::fee()` (2024-12-11, adjusted for
//! protocol 23) — i.e. the same ladder the official SDK uses to price a
//! simulated invocation — and `transaction_core::set_network_fee_ladder` lets
//! the configuration authority update the mirror after a network upgrade
//! without a redeploy.
//!
//! `total` is the *whole* fee an account pays for the transaction: every
//! resource dimension plus the classic inclusion fee (100 stroops) and the
//! envelope-size fee. The archive/history write fee
//! ([`PUBNET_FEE_PER_HISTORICAL_1KB`]) is deliberately excluded: it is charged
//! on the transaction *result*, whose size is only known after the transaction
//! has run, and the host's own `InvocationResources::estimate_fees` (which is
//! what `simulateTransaction` reports as `minResourceFee`) excludes it too.
//!
//! # TTL / rent dimension (#290)
//!
//! Extending the TTL of a persistent entry is *not* free: the network bills one
//! entry-write plus a rent bump proportional to `entry_size * ledgers`
//! ("ledger-bytes"). [`ttl_refresh_resources`] models exactly that, so a
//! long-running transaction that keeps its state alive also pays for it.

use crate::error::TransactionError;
use crate::types::{GasEstimate, Operation, OperationType, Parameter};
use soroban_sdk::{Env, Vec, contracttype};

// ── Network ceilings (per-transaction resource limits) ───────────────────
/// Maximum CPU instructions billed for a single transaction.
pub const MAINNET_MAX_CPU_INSTRUCTIONS: u64 = 100_000_000;
/// Maximum ledger entries that may be read by one transaction.
pub const MAINNET_MAX_READ_LEDGER_ENTRIES: u32 = 2_000;
/// Maximum ledger entries that may be written by one transaction.
pub const MAINNET_MAX_WRITE_LEDGER_ENTRIES: u32 = 2_000;
/// Maximum number of bytes that may be read from the ledger.
pub const MAINNET_MAX_READ_BYTES: u32 = 64 * 1024;
/// Maximum number of bytes that may be written to the ledger.
pub const MAINNET_MAX_WRITE_BYTES: u32 = 64 * 1024;

// ── Fee-ladder geometry (mirrors `soroban_env_host::fees`) ───────────────
/// Instructions billed as one fee increment.
pub const INSTRUCTIONS_INCREMENT: i64 = 10_000;
/// Bytes billed as one fee increment for every byte-sized dimension.
pub const DATA_SIZE_1KB_INCREMENT: i64 = 1_024;
/// Size of a TTL entry write triggered by a rent bump.
pub const TTL_ENTRY_SIZE: i64 = 48;

// ── Pubnet fee snapshot (stroops) ────────────────────────────────────────
/// Stroops per [`INSTRUCTIONS_INCREMENT`] instructions.
pub const PUBNET_FEE_PER_INSTRUCTION_INCREMENT: i64 = 25;
/// Stroops per ledger entry read (a write also counts as a read).
///
/// Named `fee_per_disk_read_entry` in protocol 23+ (`FeeConfiguration`); the
/// protocol-20 name is kept here for continuity with the RPC responses.
pub const PUBNET_FEE_PER_READ_ENTRY: i64 = 6_250;
/// Stroops per ledger entry write.
pub const PUBNET_FEE_PER_WRITE_ENTRY: i64 = 10_000;
/// Stroops per 1 KiB read from the ledger.
pub const PUBNET_FEE_PER_READ_1KB: i64 = 1_786;
/// Stroops per 1 KiB written to the ledger.
pub const PUBNET_FEE_PER_WRITE_1KB: i64 = 3_500;
/// Stroops per 1 KiB written to history.
pub const PUBNET_FEE_PER_HISTORICAL_1KB: i64 = 16_235;
/// Stroops per 1 KiB of contract events.
pub const PUBNET_FEE_PER_CONTRACT_EVENT_1KB: i64 = 10_000;
/// Stroops per 1 KiB of transaction size.
pub const PUBNET_FEE_PER_TRANSACTION_SIZE_1KB: i64 = 1_624;
/// Stroops per 1 KiB of rent (before the rate denominator).
pub const PUBNET_FEE_PER_RENT_1KB: i64 = 12_000;
/// Divisor applied to persistent rent ledger-bytes.
pub const PUBNET_PERSISTENT_RENT_RATE_DENOMINATOR: i64 = 2_103;
/// Divisor applied to temporary rent ledger-bytes.
pub const PUBNET_TEMPORARY_RENT_RATE_DENOMINATOR: i64 = 4_206;
/// Classic per-transaction base fee every Soroban transaction still pays.
pub const NETWORK_BASE_INCLUSION_FEE_STROOPS: i64 = 100;

// ── Operation profiling constants ────────────────────────────────────────
/// CPU instructions required to dispatch one cross-contract call through the
/// host (argument serialisation + frame setup + return deserialisation).
pub const CPU_INSTRUCTIONS_PER_CONTRACT_CALL: u64 = 30_000;
/// CPU instructions allocated per operation parameter.
pub const CPU_INSTRUCTIONS_PER_PARAM_BASE: u64 = 1_500;
/// CPU instructions allocated per parameter payload byte (XDR decode).
pub const CPU_INSTRUCTIONS_PER_PARAM_BYTE: u64 = 50;
/// CPU instructions allocated per cross-contract dependency state check.
pub const CPU_INSTRUCTIONS_PER_DEPENDENCY: u64 = 5_000;
/// Ledger entries read per operation: its own record plus the target contract
/// instance. Each dependency adds one further read in `operation_resources`.
pub const READ_ENTRIES_PER_OPERATION: u32 = 2;
/// Ledger entries written per operation: its result record plus the refreshed
/// parent transaction record.
pub const WRITE_ENTRIES_PER_OPERATION: u32 = 2;
/// Conservative XDR size of a persisted entry (key + lease + value).
pub const ENTRY_BASE_BYTES: u32 = 144;
/// Conservative XDR size of the operation record written for every operation.
pub const OPERATION_ENTRY_BYTES: u32 = 192;
/// Bytes of diagnostic contract event emitted per operation.
pub const EVENT_BYTES_PER_OPERATION: u32 = 96;
/// XDR overhead of the transaction envelope itself.
pub const TX_SIZE_BASE_BYTES: u32 = 480;
/// Ledgers of TTL refresh priced into a default estimate (≈ 2 days at 6 s).
pub const DEFAULT_TTL_BUMP_LEDGERS: u32 = 17_280;

/// Retained for compatibility with previously generated estimates.
pub const MAINNET_STROOPS_PER_10K_INSTRUCTIONS: i64 = PUBNET_FEE_PER_INSTRUCTION_INCREMENT;
/// Superseded by [`NetworkFeeParams`]: a 1:1 gas/stroop ratio never held anywhere.
pub const STROOPS_PER_GAS: i128 = 1;

/// Base CPU instruction weight per operation type.
///
/// The per-call dispatch overhead ([`CPU_INSTRUCTIONS_PER_CONTRACT_CALL`]) is
/// added on top by [`op_gas`], because every operation here is an outbound
/// cross-contract invocation.
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

/// Extra ledger entries an operation type writes beyond the baseline, e.g.
/// royalty distribution fans out to one balance entry per recipient and
/// settlement touches the escrow entry in addition to its own record.
pub fn operation_extra_write_entries(op_type: &OperationType) -> u32 {
    match op_type {
        OperationType::RoyaltyDistribution => 3,
        OperationType::SettlementEscrow | OperationType::SettlementRelease => 2,
        OperationType::NftMint => 1,
        OperationType::MarketplaceBid => 1,
        OperationType::VerificationCheck => 0,
        _ => 1,
    }
}

/// Relative XDR size multiplier of the value written by an operation type.
///
/// A verification check stores a small flag; a settlement record carries
/// amounts, parties and a token identifier.
pub fn operation_entry_bytes(op_type: &OperationType) -> u32 {
    match op_type {
        OperationType::VerificationCheck => ENTRY_BASE_BYTES,
        OperationType::PaymentTransfer | OperationType::NftApprove => ENTRY_BASE_BYTES + 48,
        OperationType::NftTransfer
        | OperationType::NftMint
        | OperationType::MetadataUpdate
        | OperationType::MarketplaceList => OPERATION_ENTRY_BYTES,
        OperationType::RoyaltyDistribution => OPERATION_ENTRY_BYTES + 96,
        OperationType::SettlementEscrow | OperationType::SettlementRelease => {
            OPERATION_ENTRY_BYTES + 144
        }
        OperationType::MarketplaceBid => OPERATION_ENTRY_BYTES + 48,
    }
}

/// CPU instructions and payload bytes of the encoded parameter vector.
pub fn parameter_payload_bytes(parameters: &Vec<Parameter>) -> u64 {
    let mut bytes: u64 = 0;
    for param in parameters.iter() {
        bytes = bytes.saturating_add(param.value.len() as u64);
    }
    bytes
}

/// Estimate the CPU instructions required by a single operation.
pub fn op_gas(op: &Operation) -> u64 {
    let base_instructions = operation_type_base_instructions(&op.operation_type)
        .saturating_add(CPU_INSTRUCTIONS_PER_CONTRACT_CALL);

    let param_payload_bytes = parameter_payload_bytes(&op.parameters);
    let param_cost = (op.parameters.len() as u64)
        .saturating_mul(CPU_INSTRUCTIONS_PER_PARAM_BASE)
        .saturating_add(param_payload_bytes.saturating_mul(CPU_INSTRUCTIONS_PER_PARAM_BYTE));

    let dep_cost = (op.dependencies.len() as u64).saturating_mul(CPU_INSTRUCTIONS_PER_DEPENDENCY);

    base_instructions
        .saturating_add(param_cost)
        .saturating_add(dep_cost)
}

// ── Resource accounting ─────────────────────────────────────────────────
/// The resource dimensions a Soroban transaction is billed on.
///
/// Field names follow `soroban_env_host::InvocationResources` so the two can be
/// compared directly when reconciling an on-chain quote against an RPC
/// simulation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResourceUsage {
    /// Metered CPU instructions.
    pub instructions: u64,
    /// Ledger entries read (does *not* include writes).
    pub read_entries: u32,
    /// Ledger entries written (each write is also billed as a read).
    pub write_entries: u32,
    /// Bytes read from the ledger.
    pub read_bytes: u32,
    /// Bytes written to the ledger.
    pub write_bytes: u32,
    /// Bytes of contract events emitted.
    pub event_bytes: u32,
    /// Rent, expressed in "ledger-bytes" = `entry_size * ledgers_bumped`.
    pub rent_ledger_bytes: u64,
    /// Number of persistent entries whose TTL was bumped.
    pub rent_bumps: u32,
}

impl ResourceUsage {
    pub fn zero() -> Self {
        ResourceUsage {
            instructions: 0,
            read_entries: 0,
            write_entries: 0,
            read_bytes: 0,
            write_bytes: 0,
            event_bytes: 0,
            rent_ledger_bytes: 0,
            rent_bumps: 0,
        }
    }

    pub fn merge(&mut self, other: &ResourceUsage) {
        self.instructions = self.instructions.saturating_add(other.instructions);
        self.read_entries = self.read_entries.saturating_add(other.read_entries);
        self.write_entries = self.write_entries.saturating_add(other.write_entries);
        self.read_bytes = self.read_bytes.saturating_add(other.read_bytes);
        self.write_bytes = self.write_bytes.saturating_add(other.write_bytes);
        self.event_bytes = self.event_bytes.saturating_add(other.event_bytes);
        self.rent_ledger_bytes = self
            .rent_ledger_bytes
            .saturating_add(other.rent_ledger_bytes);
        self.rent_bumps = self.rent_bumps.saturating_add(other.rent_bumps);
    }
}

/// The network fee ladder, mirrored into contract storage.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NetworkFeeParams {
    pub fee_per_instruction_increment: i64,
    pub fee_per_read_entry: i64,
    pub fee_per_write_entry: i64,
    pub fee_per_read_1kb: i64,
    pub fee_per_write_1kb: i64,
    pub fee_per_historical_1kb: i64,
    pub fee_per_contract_event_1kb: i64,
    pub fee_per_transaction_size_1kb: i64,
    pub fee_per_rent_1kb: i64,
    pub persistent_rate_denominator: i64,
    pub temporary_rate_denominator: i64,
    /// Classic (non-resource) inclusion fee every transaction pays.
    pub base_inclusion_fee_stroops: i64,
    /// Estimated XDR size of the submitted envelope, used for the per-KiB
    /// transaction-size fee.
    pub estimated_tx_size_bytes: u32,
    /// Operator-controlled safety multiplier over the *resource* portion of the
    /// fee, in basis points (10_000 = exactly the network ladder).
    pub congestion_multiplier_bps: u32,
    /// Ledger in which these parameters were written (0 = built-in defaults).
    pub updated_at_ledger: u32,
}

impl NetworkFeeParams {
    /// The Pubnet defaults documented at the top of this module.
    pub fn mainnet() -> Self {
        NetworkFeeParams {
            fee_per_instruction_increment: PUBNET_FEE_PER_INSTRUCTION_INCREMENT,
            fee_per_read_entry: PUBNET_FEE_PER_READ_ENTRY,
            fee_per_write_entry: PUBNET_FEE_PER_WRITE_ENTRY,
            fee_per_read_1kb: PUBNET_FEE_PER_READ_1KB,
            fee_per_write_1kb: PUBNET_FEE_PER_WRITE_1KB,
            fee_per_historical_1kb: PUBNET_FEE_PER_HISTORICAL_1KB,
            fee_per_contract_event_1kb: PUBNET_FEE_PER_CONTRACT_EVENT_1KB,
            fee_per_transaction_size_1kb: PUBNET_FEE_PER_TRANSACTION_SIZE_1KB,
            fee_per_rent_1kb: PUBNET_FEE_PER_RENT_1KB,
            persistent_rate_denominator: PUBNET_PERSISTENT_RENT_RATE_DENOMINATOR,
            temporary_rate_denominator: PUBNET_TEMPORARY_RENT_RATE_DENOMINATOR,
            base_inclusion_fee_stroops: NETWORK_BASE_INCLUSION_FEE_STROOPS,
            estimated_tx_size_bytes: TX_SIZE_BASE_BYTES,
            congestion_multiplier_bps: 10_000,
            updated_at_ledger: 0,
        }
    }
}

/// Per-dimension stroop breakdown produced by [`estimate_fees`].
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeBreakdown {
    pub instructions: i128,
    pub read_entries: i128,
    pub write_entries: i128,
    pub read_bytes: i128,
    pub write_bytes: i128,
    pub contract_events: i128,
    pub rent: i128,
    pub transaction_size: i128,
    pub base_inclusion: i128,
    pub total: i128,
}

/// Storage key for the mirrored fee ladder (instance storage).
#[derive(Clone)]
#[contracttype]
pub enum GasKey {
    NetworkFeeLadder,
}

/// Reject fee parameters that cannot possibly describe a real network.
pub fn validate_fee_params(params: &NetworkFeeParams) -> Result<(), TransactionError> {
    if params.fee_per_instruction_increment <= 0
        || params.fee_per_read_entry <= 0
        || params.fee_per_write_entry <= 0
        || params.fee_per_read_1kb <= 0
        || params.fee_per_write_1kb <= 0
        || params.fee_per_contract_event_1kb <= 0
        || params.fee_per_transaction_size_1kb <= 0
        || params.fee_per_rent_1kb <= 0
        || params.persistent_rate_denominator <= 0
        || params.temporary_rate_denominator <= 0
        || params.base_inclusion_fee_stroops < 0
    {
        return Err(TransactionError::InvalidConfiguration);
    }
    // A buffer below the network minimum, or absurdly above it, is a mistake.
    if params.congestion_multiplier_bps < 10_000
        || params.congestion_multiplier_bps > 1_000_000
        || params.estimated_tx_size_bytes < TX_SIZE_BASE_BYTES
        || params.estimated_tx_size_bytes > 128_000
    {
        return Err(TransactionError::InvalidConfiguration);
    }
    Ok(())
}

/// Read the active fee ladder, falling back to the Pubnet defaults.
pub fn get_network_fee_params(env: &Env) -> NetworkFeeParams {
    env.storage()
        .instance()
        .get(&GasKey::NetworkFeeLadder)
        .unwrap_or_else(NetworkFeeParams::mainnet)
}

/// Install a refreshed fee ladder (admin-only; authorisation is checked by the
/// contract entry point in `transaction_core`).
pub fn set_network_fee_params(
    env: &Env,
    params: &NetworkFeeParams,
) -> Result<(), TransactionError> {
    validate_fee_params(params)?;
    let mut stored = params.clone();
    stored.updated_at_ledger = env.ledger().sequence();
    env.storage()
        .instance()
        .set(&GasKey::NetworkFeeLadder, &stored);
    Ok(())
}

/// `ceil(value * fee_rate / increment)` — the host's fee primitive.
pub fn compute_fee_per_increment(value: i64, fee_rate: i64, increment: i64) -> i64 {
    let increment = if increment <= 0 { 1 } else { increment };
    let product = value.saturating_mul(fee_rate);
    if product <= 0 {
        return 0;
    }
    (product / increment).saturating_add(if product % increment == 0 { 0 } else { 1 })
}

/// Storage/CPU/event resources consumed by a single operation.
pub fn operation_resources(op: &Operation) -> ResourceUsage {
    let payload_bytes = parameter_payload_bytes(&op.parameters) as u32;
    let dependency_count = op.dependencies.len();
    let extra_writes = operation_extra_write_entries(&op.operation_type);
    let entry_bytes = operation_entry_bytes(&op.operation_type);

    let read_entries = READ_ENTRIES_PER_OPERATION.saturating_add(dependency_count);
    let write_entries = WRITE_ENTRIES_PER_OPERATION.saturating_add(extra_writes);

    // Every persisted value is read back at least once (validation) and every
    // payload is decoded from XDR before it reaches the target contract.
    let read_bytes = read_entries
        .saturating_mul(ENTRY_BASE_BYTES)
        .saturating_add(payload_bytes);
    let write_bytes = write_entries
        .saturating_mul(entry_bytes)
        .saturating_add(payload_bytes);

    ResourceUsage {
        instructions: op_gas(op),
        read_entries,
        write_entries,
        read_bytes,
        write_bytes,
        event_bytes: EVENT_BYTES_PER_OPERATION.saturating_add(payload_bytes),
        rent_ledger_bytes: 0,
        rent_bumps: 0,
    }
}

/// Resources consumed by keeping `entries` persistent entries of `entry_bytes`
/// alive for another `ledgers` ledgers (#290).
///
/// The bump is deliberately *not* also counted in `write_entries`: like the
/// host, [`estimate_fees`] charges each bump as one entry write
/// (`rent_bumps`) plus a 48-byte TTL write, so counting it twice here would
/// double the price of the cheapest operation in the model.
pub fn ttl_refresh_resources(entries: u32, entry_bytes: u32, ledgers: u32) -> ResourceUsage {
    ResourceUsage {
        instructions: (entries as u64).saturating_mul(CPU_INSTRUCTIONS_PER_PARAM_BASE),
        read_entries: 0,
        write_entries: 0,
        read_bytes: 0,
        write_bytes: 0,
        event_bytes: 0,
        rent_ledger_bytes: (entry_bytes as u64)
            .saturating_mul(ledgers as u64)
            .saturating_mul(entries as u64),
        rent_bumps: entries,
    }
}

/// Aggregate the resources consumed by a whole transaction, including the rent
/// of keeping its state alive for another `ttl_ledgers` ledgers.
pub fn total_resources(operations: &Vec<Operation>, ttl_ledgers: u32) -> ResourceUsage {
    let mut usage = ResourceUsage::zero();
    for op in operations.iter() {
        usage.merge(&operation_resources(&op));
    }

    // A transaction with no operations bumps no TTL and writes no state, so
    // there is no rent to price.
    if operations.is_empty() {
        return usage;
    }

    // Two persistent entries carry a transaction: the transaction record
    // (`DataKey::Transaction`) and the operation map (`OpStoreKey::Ops`). The
    // operation map grows with the number of operations, so price it as the
    // larger of the two.
    let operation_map_bytes =
        OPERATION_ENTRY_BYTES.saturating_add(operations.len().saturating_mul(ENTRY_BASE_BYTES));
    let entry_bytes = OPERATION_ENTRY_BYTES.max(operation_map_bytes);
    usage.merge(&ttl_refresh_resources(2, entry_bytes, ttl_ledgers));

    usage
}

/// Price a [`ResourceUsage`] on the given ladder, mirroring
/// `InvocationResources::estimate_fees`.
pub fn estimate_fees(params: &NetworkFeeParams, usage: &ResourceUsage) -> FeeBreakdown {
    let scale = |value: i128| apply_multiplier_cost_bps(value, params.congestion_multiplier_bps);
    let fee = |value: i64, rate: i64, increment: i64| {
        compute_fee_per_increment(value, rate, increment) as i128
    };

    let instructions = scale(fee(
        usage.instructions as i64,
        params.fee_per_instruction_increment,
        INSTRUCTIONS_INCREMENT,
    ));

    // A ledger write is always also billed as a ledger read.
    let billed_reads = (usage.read_entries as i128).saturating_add(usage.write_entries as i128);
    let read_entries = scale(billed_reads.saturating_mul(params.fee_per_read_entry as i128));
    let write_entries =
        scale((usage.write_entries as i128).saturating_mul(params.fee_per_write_entry as i128));

    let read_bytes = scale(fee(
        usage.read_bytes as i64,
        params.fee_per_read_1kb,
        DATA_SIZE_1KB_INCREMENT,
    ));
    let write_bytes = scale(fee(
        usage.write_bytes as i64,
        params.fee_per_write_1kb,
        DATA_SIZE_1KB_INCREMENT,
    ));
    let contract_events = scale(fee(
        usage.event_bytes as i64,
        params.fee_per_contract_event_1kb,
        DATA_SIZE_1KB_INCREMENT,
    ));

    // Rent = the ledger-byte rate spread over the persistent rate denominator,
    // plus one TTL entry write (entry fee + 48-byte TTL write) per bump.
    let rent_increment = DATA_SIZE_1KB_INCREMENT.saturating_mul(params.persistent_rate_denominator);
    let rent = scale(
        fee(
            usage.rent_ledger_bytes as i64,
            params.fee_per_rent_1kb,
            rent_increment,
        )
        .saturating_add(
            (usage.rent_bumps as i128).saturating_mul(params.fee_per_write_entry as i128),
        )
        .saturating_add(fee(
            (usage.rent_bumps as i64).saturating_mul(TTL_ENTRY_SIZE),
            params.fee_per_write_1kb,
            DATA_SIZE_1KB_INCREMENT,
        )),
    );

    // The envelope fee and the classic base fee are not resource dimensions and
    // are therefore never congestion-scaled.
    let transaction_size = fee(
        params.estimated_tx_size_bytes as i64,
        params.fee_per_transaction_size_1kb,
        DATA_SIZE_1KB_INCREMENT,
    );
    let base_inclusion = params.base_inclusion_fee_stroops.max(0) as i128;

    let total = instructions
        .saturating_add(read_entries)
        .saturating_add(write_entries)
        .saturating_add(read_bytes)
        .saturating_add(write_bytes)
        .saturating_add(contract_events)
        .saturating_add(rent)
        .saturating_add(transaction_size)
        .saturating_add(base_inclusion);

    FeeBreakdown {
        instructions,
        read_entries,
        write_entries,
        read_bytes,
        write_bytes,
        contract_events,
        rent,
        transaction_size,
        base_inclusion,
        total,
    }
}
/// Quote gas and stroops for `operations` on an explicit ladder.
pub fn estimate_gas_with_params(
    params: &NetworkFeeParams,
    operations: &Vec<Operation>,
) -> GasEstimate {
    estimate_gas_with_params_at_ttl(params, operations, DEFAULT_TTL_BUMP_LEDGERS)
}

/// As [`estimate_gas_with_params`], but pricing an explicit TTL horizon — used
/// by the long-running flows in #290 that keep state alive for days.
pub fn estimate_gas_with_params_at_ttl(
    params: &NetworkFeeParams,
    operations: &Vec<Operation>,
    ttl_ledgers: u32,
) -> GasEstimate {
    let usage = total_resources(operations, ttl_ledgers);
    let fees = estimate_fees(params, &usage);
    GasEstimate {
        estimated_gas: usage.instructions,
        estimated_cost: fees.total,
    }
}

/// Quote gas and stroops using the ladder currently installed in storage.
pub fn estimate_gas(env: &Env, operations: &Vec<Operation>) -> GasEstimate {
    estimate_gas_with_params(&get_network_fee_params(env), operations)
}

/// Estimate the total gas (CPU instructions) and stroop cost of a transaction.
///
/// The ladder is not read from storage here so that this stays a pure function
/// usable from the optimizer and from `#[test]` setups; `estimate_gas` is the
/// storage-aware variant used by the contract entry points.
pub fn total_gas(operations: &Vec<Operation>) -> GasEstimate {
    estimate_gas_with_params(&NetworkFeeParams::mainnet(), operations)
}

/// Legacy entry point: price a bare instruction count plus its dependency
/// footprint. Kept so previously generated quotes keep compiling; it now routes
/// through the real ladder instead of the old `STROOPS_PER_GAS` ratio.
pub fn calculate_stroop_cost(gas_instructions: u64, dependency_count: usize) -> i128 {
    let dependencies = dependency_count as u32;
    let usage = ResourceUsage {
        instructions: gas_instructions,
        read_entries: READ_ENTRIES_PER_OPERATION.saturating_add(dependencies),
        write_entries: WRITE_ENTRIES_PER_OPERATION.saturating_add(dependencies),
        read_bytes: (READ_ENTRIES_PER_OPERATION.saturating_add(dependencies))
            .saturating_mul(ENTRY_BASE_BYTES),
        write_bytes: (WRITE_ENTRIES_PER_OPERATION.saturating_add(dependencies))
            .saturating_mul(OPERATION_ENTRY_BYTES),
        event_bytes: EVENT_BYTES_PER_OPERATION,
        rent_ledger_bytes: 0,
        rent_bumps: 0,
    };
    estimate_fees(&NetworkFeeParams::mainnet(), &usage).total
}

/// Reject transactions whose estimated footprint cannot fit in one mainnet
/// transaction, before any state is written.
pub fn validate_gas_limits(operations: &Vec<Operation>) -> Result<(), TransactionError> {
    let usage = total_resources(operations, DEFAULT_TTL_BUMP_LEDGERS);
    if usage.instructions > MAINNET_MAX_CPU_INSTRUCTIONS {
        return Err(TransactionError::GasLimitExceeded);
    }
    if usage.read_entries > MAINNET_MAX_READ_LEDGER_ENTRIES {
        return Err(TransactionError::GasLimitExceeded);
    }
    if usage.write_entries > MAINNET_MAX_WRITE_LEDGER_ENTRIES {
        return Err(TransactionError::GasLimitExceeded);
    }
    if usage.read_bytes > MAINNET_MAX_READ_BYTES {
        return Err(TransactionError::GasLimitExceeded);
    }
    if usage.write_bytes > MAINNET_MAX_WRITE_BYTES {
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
